#!/usr/bin/env bash
# Cycle de test Sore Security avec sortie filtrée.
# Usage : test-cycle.sh [motif-jest]   ;   KEEP_DB=1 pour ne pas détruire le conteneur.
set -uo pipefail

PATTERN="${1:-}"
LOGDIR=".test-logs"; mkdir -p "$LOGDIR"
LOG="$LOGDIR/last.log"
LOCK="$LOGDIR/.jest.lock"

if [[ -e "$LOCK" ]] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "ABANDON : un run Jest est déjà en cours (pid $(cat "$LOCK")). Pas de runs concurrents sur postgres-test."
  exit 2
fi
echo $$ > "$LOCK"
cleanup() {
  rm -f "$LOCK"
  if [[ -z "${KEEP_DB:-}" ]]; then docker compose down -v >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

docker compose up -d >/dev/null 2>&1 || { echo "ÉCHEC docker compose up"; exit 1; }
if ! npm run -s db:test:migrate > "$LOGDIR/migrate.log" 2>&1; then
  echo "ÉCHEC migration test — extrait :"; tail -20 "$LOGDIR/migrate.log"; exit 1
fi

if [[ -n "$PATTERN" ]]; then
  npx jest "$PATTERN" > "$LOG" 2>&1; RC=$?
else
  npx jest > "$LOG" 2>&1; RC=$?
fi

echo "== Résultat (log complet : $LOG)"
grep -E '^(Tests|Test Suites|Snapshots|Time):' "$LOG" || echo "(pas de ligne de résumé Jest — voir le log)"

FAILS=$(grep -c '^  ● ' "$LOG" || true)
if [[ "$FAILS" -gt 0 ]]; then
  echo; echo "== Échecs ($FAILS) — 25 premières lignes de chacun, 10 max"
  awk '/^  ● /{n++; c=0; on=1} /^(Test Suites:|Tests:|PASS |FAIL )/{on=0} on && n<=10 && c<25 {print; c++}' "$LOG"
  echo; echo "== Fichiers en échec"
  grep -E '^FAIL ' "$LOG" | sort -u
  if grep -E '^FAIL ' "$LOG" | grep -qv 'ingest.integration'; then :; else
    echo; echo "NOTE : seul ingest.integration échoue → flake connu. Relancer : test-cycle.sh ingest"
  fi
fi
exit $RC
