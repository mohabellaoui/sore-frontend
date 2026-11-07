---
name: sore-test-cycle
description: Lancer la suite de tests du backend Sore Security (Jest + postgres-test Docker) avec une sortie filtrée qui ne remonte que le résumé et les échecs. Utiliser pour tout run de tests, avant tout commit, et pour diagnostiquer un test en échec.
---

# Cycle de test

## Commande unique
```bash
bash .claude/skills/sore-test-cycle/scripts/test-cycle.sh            # suite complète
bash .claude/skills/sore-test-cycle/scripts/test-cycle.sh argus      # fichiers correspondant au motif
KEEP_DB=1 bash .claude/skills/sore-test-cycle/scripts/test-cycle.sh  # garder le conteneur (itérations rapides)
```
Le script : `docker compose up -d` → `npm run db:test:migrate` → `npx jest` → `docker compose down -v`,
écrit le log complet dans `.test-logs/last.log` et n'affiche que :
la ligne `Tests:`, la ligne `Test Suites:`, et les blocs `●` des tests en échec (tronqués).

C'est la **sortie brute filtrée** — elle vaut preuve pour le commit (pas un résumé rédigé par Claude).

## Règles
- **Jamais deux runs Jest en parallèle** contre `postgres-test` (freeze CPU / zombies). Le script pose un verrou.
- Flake connu : `ingest.integration.test.js` échoue uniquement sous charge parallèle complète, passe isolé.
  Si c'est le seul échec : relancer `test-cycle.sh ingest` ; s'il passe, c'est le flake. Ne pas réinvestiguer.
- Pour diagnostiquer un échec : lire `.test-logs/last.log` avec Grep sur le nom du test, pas en entier.
- Itération sur un seul fichier : motif + `KEEP_DB=1`, puis un run complet final sans `KEEP_DB`.
- Pré-commit : le dernier run complet doit afficher `0 failed` (ou aucune mention `failed`).

`.test-logs/` doit être dans `.gitignore`.
