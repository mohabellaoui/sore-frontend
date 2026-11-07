---
name: sore-docs-sync
description: Garder docs/ synchronisé avec le code Sore Security (src/agents/X.js → docs/X.md, routes → docs/api-reference.md, schéma → section DB de TECH-DOC). Utiliser après toute modification d'agent, de route ou de migration, avant chaque commit, et pour mettre à jour la documentation technique (TECH-DOC).
---

# Synchronisation docs ↔ code

## Détection automatique
```bash
bash .claude/skills/sore-docs-sync/scripts/docs-drift.sh          # vs main
bash .claude/skills/sore-docs-sync/scripts/docs-drift.sh --stale  # + mentions obsolètes connues
```
Sortie : agents modifiés sans doc, routes ajoutées absentes de `api-reference.md`,
mentions « à écrire » / « TODO » dans docs/.

## Règles d'écriture (courtes = moins de tokens à relire plus tard)
- Doc d'un agent : **tableaux**, pas de prose. Sections fixes :
  Rôle (2 lignes) · Tables · Fonctions exportées · Routes (méthode, chemin, rôles) · Guards (code d'erreur) · CHRONICLE · Tests (nb, fichiers) · Dette connue.
- Chiffres (nb tests, routes) : issus d'une commande, jamais estimés.
  `grep -cE "^\s*(test|it)\(" __tests__/unit/agents/X.test.js`
- Mettre à jour les comptes dans le même commit que le code.
- Ne pas décrire ce qui n'est pas implémenté comme existant (ex. `attack_paths` : table sans fonctions).

## Écarts connus à corriger quand on touche ces fichiers
- `hephaestus.md` : routes « à écrire » → faux, elles existent.
- `atlas.md` : tests « à écrire » → faux.
- `argus.md` : 2 mentions résiduelles de tests Jest manquants → faux depuis `0dc6bbb`.
- TECH-DOC-001 (superseded par TECH-DOC-002) : DNS chez OVH (pas Cloudflare), mail OVH Zimbra,
  ARIA sans SSE (request/response), rôle `viewer` inexistant, IA Gemini → Groq → Anthropic.
