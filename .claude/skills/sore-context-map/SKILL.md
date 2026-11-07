---
name: sore-context-map
description: Localiser routes, fonctions, tables et tests du backend Sore Security sans lire de gros fichiers. Utiliser AVANT toute lecture de src/index.js, src/config/migrate.js ou d'un agent, et pour toute question "où est X".
---

# Carte de contexte — lire ciblé, pas en entier

`src/index.js` et `src/config/migrate.js` sont volumineux. Les lire en entier consomme des
dizaines de milliers de tokens pour en utiliser quelques dizaines de lignes.

## Procédure

1. Lancer la carte sur le motif recherché (module, route, table, fonction) :
   ```bash
   bash .claude/skills/sore-context-map/scripts/context-map.sh argus
   bash .claude/skills/sore-context-map/scripts/context-map.sh "api/themis"
   bash .claude/skills/sore-context-map/scripts/context-map.sh helios_runs
   ```
   Sortie : routes (fichier:ligne), définitions de fonctions, tables dans migrate.js, fichiers de test, doc.
2. Lire uniquement la zone utile : `Read` avec `offset` = ligne − 5 et `limit` 40–80.
3. Pour une vue d'ensemble d'un fichier sans le lire : `context-map.sh --outline src/agents/argus.js`
   (liste les fonctions exportées et leurs lignes).
4. Recherche transverse floue (plusieurs conventions de nommage, plusieurs repos) → déléguer à un
   sous-agent `Explore` et ne garder que sa conclusion.

## Interdits
- `cat` / `Read` sans limite sur index.js, migrate.js, frontend `index.html`.
- Relire un fichier déjà lu dans la session s'il n'a pas changé.
