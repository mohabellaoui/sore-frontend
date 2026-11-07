---
name: sore-ai-layer
description: Écrire ou modifier un prompt, un appel IA ou un agent génératif de la plateforme Sore Security (aiEngine, aiPromptGuards, aiReportReview, ARIA, SENTINEL, SCRIBE, SAGE, AUGUR) en respectant le white-label, l'anti-hallucination et le budget d'appels. Utiliser pour toute modification touchant callAI, callAIFreeText ou un contenu généré pour un client.
---

# Couche IA

## Architecture (ne pas contourner)
- Point d'entrée unique : `src/services/aiEngine.js` — chaîne de fallback Gemini → Groq → Anthropic.
  Aucun SDK de vendor importé ailleurs.
- `callAI()` = contrat JSON (ne pas casser). Texte libre → `callAIFreeText()`.
- Validation de sortie : `src/services/aiPromptGuards.js` (validateurs écrits à la main, pas de zod/ajv).
- QA des rapports : `src/services/aiReportReview.js` — auto sur les 4 types de rapports déclenchés
  par un humain, **exclu du cron AURORA**, relance manuelle `POST /api/reports/:type/:id/qa-review`.

## Règles de prompt (qualité + coût)
1. **Données, pas récit** : passer au modèle un objet JSON compact (champs utiles seulement), jamais
   des lignes de logs brutes ou des tables complètes. Tronquer `raw_message`, limiter les tableaux (top N).
2. **Sortie contrainte** : schéma JSON explicite dans le prompt + validateur dans aiPromptGuards.
   Rejet → 1 retry maximum avec le message d'erreur du validateur, puis échec propre.
3. **Faits fournis uniquement** : « n'utilise que les champs fournis ; si une info manque, écris null ».
   Les chiffres affichés (nb d'actifs, findings, scores) sont calculés en code et injectés, jamais
   produits par le modèle.
4. **Prompt système stable en tête, données variables à la fin** (maximise le cache des fournisseurs).
5. **Langue** : français pour tout livrable client ; termes techniques anglais admis (MFA, WAF, CDN).
6. **Budget** : pas d'appel IA dans une boucle par log ; agréger d'abord. Préférer un appel batch.

## White-label (doctrine commerciale)
- Jamais « Anthropic / Claude / Groq / Gemini / Google / Meta / OpenAI / GPT / Llama » dans un texte
  visible client (rapports, emails HERALD, UI War Room, PDF/DOCX). Signature : « Plateforme
  d'intelligence souveraine Sore Security ».
- Le validateur de sortie doit rejeter toute mention de vendor (le modèle peut s'auto-nommer).
- On-premise BYOK : le client voit le vendor uniquement en créant sa propre clé — ne pas mélanger les récits.

## Test
- Unitaire : mocker `aiEngine` ; tester le validateur sur sortie valide, JSON cassé, champ manquant,
  mention de vendor, chiffre inventé ≠ donnée injectée.
