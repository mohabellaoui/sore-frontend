#!/usr/bin/env bash
# Contrôles déterministes des invariants Sore Security. Sortie courte : OK / WARN fichier:ligne.
# Usage : check-invariants.sh [--diff]
set -uo pipefail

FILES=()
if [[ "${1:-}" == "--diff" ]]; then
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1)
  while IFS= read -r f; do [[ -f "$f" ]] && FILES+=("$f"); done < <(git diff --name-only "$BASE" -- 'src/*.js' 'src/**/*.js')
  while IFS= read -r f; do FILES+=("$f"); done < <(git ls-files --others --exclude-standard -- 'src/*.js' 'src/**/*.js')
  [[ ${#FILES[@]} -eq 0 ]] && { echo "Aucun fichier src/ modifié."; exit 0; }
  echo "Périmètre : ${#FILES[@]} fichier(s) modifié(s)"
else
  while IFS= read -r f; do FILES+=("$f"); done < <(find src -name '*.js' -not -path '*/node_modules/*' 2>/dev/null)
fi

WARNS=0
# Lignes de commentaire (JS //, /*, * JSDoc ; SQL --) : jamais significatives pour les invariants.
COMMENT_RE='^[^:]+:[0-9]+:[[:space:]]*(//|/\*|\*|--)'
report() { # $1 = libellé, $2 = sortie déjà filtrée
  local out
  out=$(printf '%s' "$2" | cut -c1-170 | head -15)
  if [[ -n "$out" ]]; then
    echo "WARN  $1"; echo "$out" | sed 's/^/      /'; WARNS=$((WARNS+1))
  else
    echo "OK    $1"
  fi
}
check() { # $1 = libellé, $2 = regex, $3 = (optionnel) regex d'exclusion
  local out
  out=$(grep -nHE "$2" "${FILES[@]}" 2>/dev/null | grep -vE "$COMMENT_RE" | { if [[ -n "${3:-}" ]]; then grep -vE "$3"; else cat; fi; })
  report "$1" "$out"
}

check "tenant_id lu depuis body/query/params (doit venir de req.user)" \
      'req\.(body|query|params)\.tenant_?[iI]d'
check "status 403 sur ressource introuvable (cross-tenant doit être 404)" \
      'rowCount *=== *0.*403|rows\.length *=== *0.*403|!(row|item|resource|found).*status\(403\)'
check "gen_random_uuid (utiliser uuid_generate_v4)" \
      'gen_random_uuid'
check "rôle 'viewer' (n'existe pas : admin/analyst/client)" \
      "['\"]viewer['\"]"
# Guard assert* qui retourne un booléen (analyse multi-lignes du corps de la fonction)
out=$(awk '/(function|const) assert[A-Za-z]+/{inside=1; depth=0}
  inside{ n=gsub(/\{/,"{"); m=gsub(/\}/,"}"); depth+=n-m;
          if ($0 ~ /return (false|true)[ ;]*$/) print FILENAME":"FNR": "$0;
          if (depth<=0 && n+m>0) inside=0 }' "${FILES[@]}" 2>/dev/null | cut -c1-170 | head -15)
if [[ -n "$out" ]]; then
  echo "WARN  guard assert* qui retourne un booléen (doit throw 'CODE:')"; echo "$out" | sed 's/^/      /'; WARNS=$((WARNS+1))
else
  echo "OK    guard assert* qui retourne un booléen"
fi
check "noms de vendor IA dans des chaînes potentiellement visibles client" \
      "['\"\`][^'\"\`]*(Anthropic|Claude|Groq|Gemini|OpenAI|GPT-|Llama|llama)[^'\"\`]*['\"\`]" \
      'aiEngine|require\(|process\.env|model:|MODEL|console\.|logger\.|apiKey|baseURL|// '
check "secret / clé en dur" \
      "([aA][pP][iI][_-]?[kK][eE][yY]|[sS]ecret|[pP]assword|[tT]oken) *[:=] *['\"][A-Za-z0-9_\-]{16,}['\"]" \
      'process\.env|example|test|placeholder'
check "ON CONFLICT sur external_assets (pas de contrainte UNIQUE)" \
      'external_assets[^;]*ON CONFLICT'
# SQL concaténé : on retire d'abord les interpolations sûres, puis on cherche un ${...} restant.
#  - $${params.push(x)} / $${values.length}  → génère un placeholder $N (sûr)
#    (uniquement params/values : un $${req.body.x} reste une injection, préfixée d'un $)
#  - ${where} / ${whereClause} / ${ownerCheck} → clauses construites uniquement de placeholders $N
#    (garanti par le contrôle « clause SQL dynamique » ci-dessous)
#  - ${CONSTANTE_MAJUSCULE}                  → constante définie dans le code
#  - ${idx} / ${i} / ${n} / ${paramIndex} / ${p} → index de placeholder
# (seuls les template literals interpolent : on cible query(`...`), apostrophes SQL autorisées dedans)
SAFE_PLACEHOLDER_SED='s/\$\$\{(params|values)\.(push\([^}]*\)|length)\}//g'
out=$(grep -nHE "query\(\`[^\`]*(SELECT|UPDATE|DELETE|INSERT)[^\`]*\\$\{" "${FILES[@]}" 2>/dev/null \
  | grep -vE "$COMMENT_RE" \
  | sed -E "$SAFE_PLACEHOLDER_SED" \
  | sed -E 's/\$\{(where|whereClause|ownerCheck|[A-Z][A-Z0-9_]*|idx|i|n|paramIndex|p)\}//g' \
  | grep -E "query\(\`[^\`]*\\$\{")
report "SQL concaténé (risque injection) — préférer \$1, \$2" "$out"

# Clause SQL dynamique : la liste blanche ci-dessus n'est sûre que si where / whereClause /
# ownerCheck (et le tableau conditions dont ils sont faits) ne contiennent que des littéraux,
# des $${params|values.push(...)} et des ${conditions.join(...)}.
# WARN si une affectation / concaténation / conditions.push contient un autre ${...}
# ou concatène (+) un identifiant autre que conditions.join(...).
# Limite : analyse ligne à ligne (un template multi-lignes n'est vu que sur sa 1re ligne).
out=$(grep -nHE '(^|[^A-Za-z0-9_.])(where|whereClause|ownerCheck)[[:space:]]*\+?=[^=]|(^|[^A-Za-z0-9_.])conditions[[:space:]]*(=[^=]|\.push\(|\.unshift\()' "${FILES[@]}" 2>/dev/null \
  | grep -vE "$COMMENT_RE" \
  | sed -E "$SAFE_PLACEHOLDER_SED" \
  | sed -E 's/\$\{conditions\.join\([^}]*\)\}//g' \
  | awk '{ line = $0; body = $0
           sub(/^[^:]+:[0-9]+:/, "", body)
           gsub(/conditions\.join\([^)]*\)/, "", body)
           if (body ~ /\$\{/) { print line; next }
           gsub(/`[^`]*`/, "", body); gsub(/\047[^\047]*\047/, "", body); gsub(/"[^"]*"/, "", body)
           if (body ~ /\+[[:space:]]*[A-Za-z_$]/) print line }')
report "clause SQL dynamique (where/ownerCheck/conditions) avec valeur non paramétrée" "$out"
# SCOUT : outil interne. Ignorés : agent/données SCOUT, constantes SCOUT_*, tags de log [SCOUT],
# et toute ligne située dans une route Express réservée au seul rôle admin.
out=$(awk '
  FNR==1 { adminOnly = 0 }
  /app\.(get|post|put|patch|delete)\(/ { adminOnly = ($0 ~ /requireRole\(.admin.\)/) }
  /SCOUT/ { print FILENAME":"FNR":"(adminOnly ? "@ADMIN@" : "")$0 }
  /^\}\);/ { adminOnly = 0 }' "${FILES[@]}" 2>/dev/null \
  | grep -vE "$COMMENT_RE" \
  | grep -vE '^[^:]+:[0-9]+:@ADMIN@|src/agents/scout|src/data/scout|generate-license|license\.js|cron|SCOUT_[A-Z_]+|\[SCOUT\]' \
  | grep -vE "[\`'\"]SCOUT:")  # codes de guard internes ('SCOUT: ...', convention throw 'CODE:')
report "SCOUT mentionné hors code interne" "$out"

# Requêtes sur alerts filtrant tenant_id (doit être client_id)
check "table alerts filtrée par tenant_id (legacy : client_id)" \
      'FROM alerts[^;`]*tenant_id'

echo
echo "Total WARN : $WARNS  (qualifier chaque WARN : vrai / faux positif + raison)"
