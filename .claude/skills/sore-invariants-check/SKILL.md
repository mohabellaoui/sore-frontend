---
name: sore-invariants-check
description: Vérifier les invariants de sécurité et d'architecture du backend Sore Security (isolation tenant, 404 cross-tenant, guards qui throw, uuid_generate_v4, rôles, CHRONICLE, white-label IA, secrets) par grep déterministe. Utiliser avant tout merge, en revue de code, et après toute modification de routes, migrations ou agents.
---

# Contrôle des invariants

## 1. Passe automatique (toujours en premier — quelques lignes de sortie)
```bash
bash .claude/skills/sore-invariants-check/scripts/check-invariants.sh          # tout le repo
bash .claude/skills/sore-invariants-check/scripts/check-invariants.sh --diff   # seulement fichiers modifiés vs main
```
Chaque ligne `WARN` donne `fichier:ligne`. Lire uniquement ces lignes (Read offset/limit).
Un `WARN` n'est pas forcément un bug : qualifier chaque cas (vrai positif / faux positif + raison).

## 2. Revue manuelle ciblée (ce que grep ne voit pas)
Pour chaque route ajoutée ou modifiée dans le diff :
- [ ] `tenant_id` provient de `req.user` (pas `req.body` / `req.query` / `req.params`)
- [ ] La requête SQL filtre sur `tenant_id` (ou `client_id` pour `alerts`)
- [ ] Ressource absente **ou** d'un autre tenant → même réponse 404
- [ ] `requireRole` avec rôles existants uniquement (`admin`, `analyst`, `client`)
- [ ] Message 403 générique, n'énumère ni domaines ni modules licenciés
- [ ] Guard métier appelé côté route **et** côté agent si scope/autorisation (cf. `assertScopeApproved`)
- [ ] Entrée CHRONICLE pour l'action
- [ ] Test d'intégration couvrant le 404 cross-tenant
- [ ] Toute nouvelle valeur interpolée dans du SQL passe par $${params.push(...)}. La liste blanche (where, ownerCheck, constantes en MAJUSCULES) n'est jamais un raccourci pour une valeur utilisateur.
- [ ] Analyse ligne par ligne : une requête SQL multi-lignes n'est vérifiée que sur sa première ligne — relire manuellement.

## 3. Référence des invariants
| Invariant | Raison |
|---|---|
| 404 jamais 403 cross-tenant | Ne pas confirmer l'existence d'une ressource (IDOR/BOLA) |
| `tenant_id` depuis `req.user` | Empêche l'escalade horizontale via le payload |
| `alerts.client_id` | Legacy — `alerts` n'a pas de `tenant_id` |
| `discovery_sessions` / `recommendations` sans tenant | Volontaire (prospects AUGUR) — ne pas « corriger » |
| Guards `throw 'CODE:'` | Un `false` ignoré = contournement silencieux |
| `uuid_generate_v4()` | Cohérence du schéma (0 `gen_random_uuid`) |
| CHRONICLE append-only | Triggers PG bloquent UPDATE/DELETE/TRUNCATE — ne jamais les retirer |
| Pas de vendor IA côté client | Doctrine commerciale « intelligence souveraine » |
| SCOUT exclu on-prem, jamais public | Outil interne |
| Rate limiter `/api/ingest` en `Map` mémoire | Dette connue : casse en scaling horizontal — signaler si on scale |
