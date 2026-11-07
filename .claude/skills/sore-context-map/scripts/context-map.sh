#!/usr/bin/env bash
# Carte de contexte : localise un motif dans le backend sans lire les fichiers entiers.
# Usage : context-map.sh <motif>          (insensible à la casse)
#         context-map.sh --outline <fichier.js>
set -euo pipefail

if [[ "${1:-}" == "--outline" ]]; then
  f="${2:?fichier requis}"
  echo "== Outline $f ($(wc -l < "$f") lignes)"
  grep -nE '^(async )?function [A-Za-z0-9_]+|^const [A-Za-z0-9_]+ = (async )?(\(|function)|^module\.exports|^exports\.[A-Za-z0-9_]+' "$f" \
    | sed -E 's/\{.*$//' | cut -c1-120
  exit 0
fi

q="${1:?usage: context-map.sh <motif> | --outline <fichier>}"
G="grep -rniE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage"

section() { echo; echo "== $1"; }

section "Routes (app.get/post/put/patch/delete)"
$G "app\.(get|post|put|patch|delete)\(['\"\`][^'\"\`]*${q}" src 2>/dev/null | cut -c1-160 | head -40 || true

section "Définitions de fonctions"
$G "(function|const|let) [A-Za-z0-9_]*${q}[A-Za-z0-9_]* *(=|\()" src 2>/dev/null | cut -c1-160 | head -30 || true

section "Tables / colonnes (migrate.js)"
if [[ -f src/config/migrate.js ]]; then
  grep -niE "CREATE TABLE[^(]*${q}|ALTER TABLE[^;]*${q}|${q}[a-z_]* +(UUID|TEXT|VARCHAR|INTEGER|JSONB|TIMESTAMPTZ|BOOLEAN)" src/config/migrate.js | cut -c1-160 | head -30 || true
fi

section "Tests"
find __tests__ -type f -iname "*${q}*" 2>/dev/null | head -20 || true
$G -l "${q}" __tests__ 2>/dev/null | head -15 | sed 's/^/  ref: /' || true

section "Docs"
find docs -type f -iname "*${q}*" 2>/dev/null | head -10 || true

echo
echo "(Lire ensuite avec Read offset=<ligne-5> limit=60 — jamais le fichier entier)"
