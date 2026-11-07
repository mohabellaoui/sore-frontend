# Sore Security — règles projet (version courte)

Contexte détaillé = dans `.claude/skills/`. Ne PAS recopier ici : ce fichier est chargé à chaque session.

## Discipline (non négociable)
- Grep les vrais fichiers avant toute affirmation. Aucune supposition sur un nom de fonction, table ou route.
- Montrer la sortie brute des commandes, jamais un résumé.
- Imprévu détecté → STOP et rapport. Pas d'auto-correction hors périmètre.
- Commit atomique : code + tests + docs dans le même commit. `npm test` → `0 failed` prouvé en sortie brute.
- Merges `--ff-only`. **Jamais de push sans feu vert explicite de Mohamed.**
- Un seul `npm test` à la fois contre `postgres-test` (risque de freeze).
- Build Docker vérifié avant tout merge ajoutant un binaire.

## Économie de contexte
- Ne jamais lire `src/index.js` en entier : `bash .claude/skills/sore-context-map/scripts/context-map.sh <motif>` puis `Read` avec offset/limit.
- Tests : `bash .claude/skills/sore-test-cycle/scripts/test-cycle.sh [pattern]` (sortie filtrée).
- Recherche large → sous-agent `Explore`, ne rapporter que la conclusion.

## Invariants (détail : skill `sore-invariants-check`)
- `tenant_id` dérivé de `req.user` uniquement. Cross-tenant → **404, jamais 403**.
- `alerts` filtre sur `client_id` (legacy). Rôles réels : `admin` / `analyst` / `client` (pas de `viewer`).
- `uuid_generate_v4()` partout. Guards = `throw` explicite `CODE_ERREUR:`, jamais de booléen silencieux.
- Toute action significative → CHRONICLE.
- Aucun nom de vendor IA (Anthropic, Groq, Gemini, Google, Meta, OpenAI) dans ce qui est visible client.

## Correspondance docs
`src/agents/X.js` → `docs/X.md` · routes → `docs/api-reference.md` · schéma → `src/config/migrate.js`
