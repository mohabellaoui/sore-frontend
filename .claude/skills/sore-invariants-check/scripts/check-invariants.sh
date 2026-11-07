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
check() { # $1 = libellé, $2 = regex, $3 = (optionnel) regex d'exclusion
  local out
  out=$(grep -nHE "$2" "${FILES[@]}" 2>/dev/null | { if [[ -n "${3:-}" ]]; then grep -vE "$3"; else cat; fi; } | cut -c1-170 | head -15)
  if [[ -n "$out" ]]; then
    echo "WARN  $1"; echo "$out" | sed 's/^/      /'; WARNS=$((WARNS+1))
  else
    echo "OK    $1"
  fi
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
check "SQL concaténé (risque injection) — préférer \$1, \$2" \
      "query\([\`'\"][^\`'\"]*(SELECT|UPDATE|DELETE|INSERT)[^\`'\"]*\\$\{" \
      '\$\{(idx|i|n|paramIndex|p)\}'
check "SCOUT mentionné hors code interne" \
      'SCOUT' \
      'src/agents/scout|generate-license|license\.js|cron|// '

# Requêtes sur alerts filtrant tenant_id (doit être client_id)
check "table alerts filtrée par tenant_id (legacy : client_id)" \
      'FROM alerts[^;`]*tenant_id'

echo
echo "Total WARN : $WARNS  (qualifier chaque WARN : vrai / faux positif + raison)"
