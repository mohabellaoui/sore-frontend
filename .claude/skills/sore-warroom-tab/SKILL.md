---
name: sore-warroom-tab
description: Ajouter ou modifier un onglet de la War Room Sore Security (repo sore-frontend, SPA vanilla JS dans un seul index.html) — prototype séparé, intégration ciblée, apiCall, JWT en mémoire, design sombre/cyan. Utiliser pour toute modification de l'interface SOC client.
---

# War Room — onglets

`index.html` est un fichier unique très long. **Ne jamais le lire en entier.**

## Repérage (ciblé)
```bash
grep -nE "data-tab=|id=\"tab-|function (load|render)[A-Z]" index.html | head -60   # carte des onglets
grep -nE "function apiCall|const API_URL|let accessToken" index.html                  # socle
```
Puis `Read` avec offset/limit sur l'onglet de référence le plus proche (ex. PERSEUS, HELIOS, APATE).

## Méthode : prototype puis fusion
1. Prototype autonome `<module>-tab-preview.html` (copie minimale du socle : variables CSS, `apiCall` mocké).
   Validation visuelle par Mohamed **avant** fusion.
2. Fusion dans `index.html` : ajouter nav + section + fonctions `load<Module>()` / `render<Module>()`.
   Ne pas réécrire de code existant hors périmètre.
3. Supprimer le code mort introduit, pas celui des autres.

## Contraintes techniques
- Appels backend via `apiCall()` existant uniquement (gère Bearer, refresh, 401 → logout).
- Tokens en variables JS en mémoire : jamais `localStorage` / `sessionStorage`.
- Toute donnée serveur insérée via `textContent` ou échappement — pas d'`innerHTML` avec données non échappées (XSS).
- URL backend : ne pas ajouter de nouvelle occurrence en dur de `sore-backend.onrender.com`
  (bloquant pour l'on-prem) — utiliser la constante existante.
- Concurrence côté client : sémaphore (cf. bulk scan `SCAN_CONCURRENCY=3`), isolation d'erreur par ligne.

## Design
Fond `#020408`, accent cyan `#00b4dc`, police mono JetBrains, esthétique War Room. Icône d'onglet emoji,
groupe de nav cohérent (ex. « Threat Intel »). Codes couleur métier assumés (APATE : délivré = ambre,
rejeté = vert, car le rejet signifie que la protection du client fonctionne).
Aucun nom de vendor IA dans l'UI.

## Vérification
Ouvrir la page (preview Vercel ou serveur local), tester l'onglet, console sans erreur, largeur mobile.
