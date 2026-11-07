---
name: sore-onprem
description: Préparer ou modifier un déploiement on-premise de la plateforme Sore Security (manifests Kubernetes k8s/, licences RS256, exclusions de modules, modèle BYOK, NetworkPolicy). Utiliser pour tout travail sur k8s/, src/services/license.js, scripts/generate-license.js ou une livraison client souverain.
---

# On-premise

## Licences (`src/services/license.js`)
- JWT RS256 signé hors ligne : `scripts/generate-license.js`, clé privée dans `.license-keys/` (gitignoré).
  **Ne jamais lire, afficher ou committer `.license-keys/`.**
- 5 statuts : `absent` (passthrough SaaS) · `valid` · `grace` (<30 j après expiration, log warning) ·
  `expired` (≥30 j → 403 sauf `/` et `/api/health`) · `invalid`.
- Claims : `excluded_modules`, `allowed_domains`. SCOUT toujours exclu pour `souverain_on_premise`.
- 403 génériques : ne jamais énumérer domaines ou modules licenciés.
- `moduleExclusionGate` est une propriété de l'app ; `module.exports = app` inchangé (13 fichiers de test en dépendent).
- Nouveau module → décider explicitement s'il entre dans `ALWAYS_EXCLUDED_ONPREM` (ex. APATE : en attente).

## Kubernetes (`k8s/`)
- Conteneur non-root, `drop: [ALL]`, liveness `/`, readiness `/api/health`.
- NetworkPolicy deny-all egress + DNS + PostgreSQL + HTTPS ; FQDN allowlist via CiliumNetworkPolicy si dispo.
- Points ouverts : `imagePullSecrets` vs package GHCR public ; Job de migration (aujourd'hui `kubectl run` ponctuel).
- URL backend en dur dans le frontend → à paramétrer avant livraison on-prem.

## BYOK
Le client fournit toutes les clés externes (IA, threat intel, email). Documenter la liste exacte des
variables requises par module activé ; aucune clé Sore Security dans un package client.

## Checklist livraison
- [ ] Licence générée (nom client, domaines, modules exclus, expiration) et vérifiée par `license.js`
- [ ] `docker build` + scan de l'image
- [ ] Migration testée sur une base vide
- [ ] Egress validé avec l'architecture VPN du client
- [ ] Runbook remis (démarrage, rotation licence, mise à jour)
