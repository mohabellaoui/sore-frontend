---
name: sore-chantier
description: Démarrer, conduire et clôturer un chantier (lot de travail) sur les repos Sore Security avec la discipline maison — spec, branche, commits atomiques code+tests+docs, preuve npm test, merge --ff-only, pas de push sans feu vert. Utiliser au début et à la fin de toute tâche de développement, et pour tout commit ou merge.
---

# Chantier — cycle complet

## Ouverture
1. `git status` + `git log --oneline -5` (sortie brute). Arbre sale → STOP, demander.
2. Vérifier qu'aucune autre session Claude Code ne travaille dans ce répertoire (collisions WIP déjà vécues).
   Besoin de parallélisme → worktree dédié.
3. Branche : `chantier/<module>-<objet>` depuis `main` à jour.
4. Écrire le plan en 5–10 lignes (fichiers touchés, tests ajoutés, docs) → validation de Mohamed
   si le chantier touche schéma, sécurité, licence ou un livrable client.

## Pendant
- Exploration via skill `sore-context-map` (jamais de lecture intégrale des gros fichiers).
- Imprévu (test rouge hors périmètre, comportement inattendu, doc contradictoire) → STOP + rapport brut.
- Un commit = une unité logique, contenant **code + tests + docs** correspondants.

## Avant chaque commit (dans cet ordre)
```bash
bash .claude/skills/sore-invariants-check/scripts/check-invariants.sh --diff
bash .claude/skills/sore-docs-sync/scripts/docs-drift.sh
bash .claude/skills/sore-test-cycle/scripts/test-cycle.sh
```
Coller les trois sorties brutes. Binaire ajouté au Dockerfile → `docker build .` réussi en plus.

Format message : `<type>(<module>): <résumé>` — types : feat, fix, test, docs, refactor, chore, sec.

## Clôture
1. `git checkout main && git merge --ff-only chantier/...` (échec ff → rebase, jamais de merge commit).
2. **Ne pas pusher.** Afficher : `git log --oneline main -n <N>` + « prêt à pusher, feu vert ? ».
3. Rapport final ≤ 10 lignes : commits, tests (ligne `Tests:` brute), docs mises à jour, dette identifiée.

## Prompt type pour Mohamed (à copier dans Claude Code)
```
Chantier <NOM> — objectif : <1 phrase>.
Skills : sore-chantier, sore-module-scaffold (si nouveau module), sore-invariants-check.
Périmètre : <fichiers/modules>. Hors périmètre : <…>.
Livrable : commits atomiques sur chantier/<…>, merge ff-only local, PAS de push.
```
