---
name: sore-website
description: Modifier le site vitrine sore-security.com (repo sore-website, Next.js App Router, TypeScript, Tailwind, Vercel) — pages, contenus commerciaux, formulaire de contact. Utiliser pour toute modification du site public.
---

# Site sore-security.com

## Repérage
```bash
ls app/ && grep -rn "export default" app --include=page.tsx | head -30
cat package.json | grep -E '"next"|"react"'        # vérifier la version réelle avant toute API Next
```

## Règles de contenu (doctrine commerciale)
- 4 pôles : Cybersécurité · Infogérance IT · Cellule de crise · Logiciels & Matériel.
- Plateforme présentée comme propriétaire : « intelligence souveraine Sore Security ». Aucun vendor IA,
  aucun outil open source tiers nommé comme produit (THEMIS, pas TheHive, etc.).
- Ne jamais mentionner SCOUT.
- Pas de nom de client, de chiffre ou de référence sans accord écrit (rapports ASA = confidentiels).
- Conformité citée exactement : CNDP (loi 09-08), RGPD, ISO 27001, Bank Al-Maghrib.

## Design
Style sobre : blanc, titres serif (Georgia), navy `#1a2b5e` seul accent, bordures fines, zéro radius.
Composants serveur par défaut ; `"use client"` seulement si interactif.

## Formulaire contact
Vérifier par grep le fournisseur réellement utilisé (Resend côté site / backend `POST /api/service-requests`)
avant toute modification — l'origine des enregistrements DNS Resend n'est pas encore confirmée.

## Vérification
`npm run build` sans erreur ni warning TypeScript ; vérifier la preview Vercel de la PR.
