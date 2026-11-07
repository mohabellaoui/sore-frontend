#!/usr/bin/env bash
# Détecte la dérive docs ↔ code. Usage : docs-drift.sh [--stale]
set -uo pipefail
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1)
CHANGED=$( { git diff --name-only "$BASE"; git diff --name-only; git ls-files --others --exclude-standard; } | sort -u )

echo "== Agents modifiés sans doc modifiée"
n=0
for f in $(echo "$CHANGED" | grep -E '^src/agents/[^/]+\.js$' || true); do
  m=$(basename "$f" .js); d="docs/$m.md"
  if [[ ! -f "$d" ]]; then echo "  MANQUANT  $d  (pour $f)"; n=$((n+1))
  elif ! echo "$CHANGED" | grep -qx "$d"; then echo "  NON MAJ   $d  (pour $f)"; n=$((n+1)); fi
done
[[ $n -eq 0 ]] && echo "  OK"

echo "== Routes ajoutées absentes de docs/api-reference.md"
n=0
if [[ -f docs/api-reference.md ]]; then
  while IFS= read -r r; do
    [[ -z "$r" ]] && continue
    grep -qF "$r" docs/api-reference.md || { echo "  ABSENTE   $r"; n=$((n+1)); }
  done < <(git diff "$BASE" -- src/index.js 2>/dev/null | grep -E '^\+.*app\.(get|post|put|patch|delete)\(' \
           | sed -E "s/.*app\.([a-z]+)\(['\"\`]([^'\"\`]+).*/\2/" | sort -u)
  [[ $n -eq 0 ]] && echo "  OK"
else
  echo "  docs/api-reference.md introuvable"
fi

echo "== Migration modifiée"
echo "$CHANGED" | grep -qx 'src/config/migrate.js' && echo "  migrate.js modifié → mettre à jour la section schéma de TECH-DOC" || echo "  OK"

if [[ "${1:-}" == "--stale" ]]; then
  echo "== Mentions potentiellement obsolètes dans docs/"
  grep -rniE 'à écrire|a ecrire|TODO|TBD|non implémenté' docs 2>/dev/null | cut -c1-150 | head -20 || echo "  aucune"
fi
