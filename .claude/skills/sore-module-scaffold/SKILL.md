---
name: sore-module-scaffold
description: Créer un nouvel agent ou module natif Sore Security (backend Node/Express + PostgreSQL) selon le pattern maison — migration, agent, routes, guards, tests unitaires + intégration, doc, CHRONICLE. Utiliser pour tout nouveau module (PERSEUS, PROFILER, GUARDIAN, SHIELD, PATCH…) ou toute nouvelle table/route d'un module existant.
---

# Scaffolding d'un module natif

Nommage mythologique obligatoire (ARGUS, THEMIS, HEPHAESTUS…). Pôle à préciser (AEGIS, LEXIS, HERMES, AURORA).

## Étape 0 — Spec avant code (STOP pour validation)
Produire, sans écrire de code, un tableau : tables (colonnes + contraintes), fonctions de l'agent,
routes (méthode, chemin, rôles), guards, entrées CHRONICLE, exclusion licence on-prem éventuelle.
Attendre la validation de Mohamed.

## Étape 1 — Repérage (économie de contexte)
```bash
bash .claude/skills/sore-context-map/scripts/context-map.sh themis   # module de référence le plus proche
```
Lire **un** module de référence de taille similaire (THEMIS pour CRUD + workflow, HEPHAESTUS pour
appels sortants, HELIOS pour runner externe) — zones ciblées seulement.

## Étape 2 — Migration (`src/config/migrate.js`)
- PK `UUID DEFAULT uuid_generate_v4()` (jamais `gen_random_uuid`).
- `tenant_id UUID NOT NULL` + FK `ON DELETE CASCADE` sur toute table de données client.
- `created_at` / `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- `CHECK (col IN (...))` pour chaque énumération.
- Index `(tenant_id, created_at DESC)` sur les tables à requêtes fréquentes.
- Idempotent : `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Pas d'`ON CONFLICT` sur une table sans contrainte UNIQUE réelle (cf. `external_assets`) → SELECT puis UPDATE/INSERT.
- Secrets : AES-256-GCM via `src/services/crypto.js` ; jamais en clair, jamais sur disque.

## Étape 3 — Agent (`src/agents/<module>.js`)
- Toutes les requêtes filtrent `tenant_id` (ou `client_id` si table `alerts`).
- Guards nommés `assert<Chose>` qui **throw** `new Error('CODE_EN_MAJ: détail')`, jamais `return false`.
- Toute action significative → CHRONICLE (`<MODULE>_<ACTION>`).
- Appels HTTP sortants vers une URL fournie → réutiliser `assertSafeWebhookUrl` (pas de copie).
- Appels IA → `src/services/aiEngine.js` uniquement (voir skill `sore-ai-layer`).
- Cron éventuel sous `if (require.main === module)` ; vérifier les créneaux existants
  (SCOUT 03:15, AURORA lun 07:00, MISP 00/06/12/18h UTC, HELIOS 02:00).

## Étape 4 — Routes (`src/index.js`)
- Middleware JWT + `requireRole(...)` ; rôles réels : `admin`, `analyst`, `client`.
- `tenant_id` depuis `req.user` uniquement, jamais body/query.
- Ressource d'un autre tenant → **404** (pas 403). Messages 403 génériques (anti-énumération).
- Gating licence via `moduleExclusionGate` si le module est excluable on-prem.
- Ne pas modifier la forme `module.exports = app`.

## Étape 5 — Tests (gabarits dans `templates/`)
- `__tests__/unit/agents/<module>.test.js` : guards (throw + code), logique pure.
- `__tests__/integration/<route>.integration.test.js` : supertest contre `postgres-test` réel,
  avec au minimum : 401 sans JWT, 403 mauvais rôle, **404 cross-tenant**, happy path, entrée CHRONICLE.
- Lancer via skill `sore-test-cycle`.

## Étape 6 — Docs + commit
- `docs/<module>.md` + `docs/api-reference.md` dans le **même commit** (skill `sore-docs-sync`).
- Clôture via skill `sore-chantier`.
