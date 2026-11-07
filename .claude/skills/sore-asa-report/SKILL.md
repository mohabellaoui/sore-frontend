---
name: sore-asa-report
description: Générer, corriger ou relire un rapport ASA (Attack Surface Assessment, reconnaissance passive) Sore Security au format .docx — cohérence des comptes, tiers d'urgence, faux positifs connus, white-label. Utiliser pour tout rapport ASA client (production, relecture, révision -REV) et pour le code qui le génère.
---

# Rapports ASA

## 1. QA automatique d'abord (ne pas relire le .docx en entier)
```bash
pip install python-docx >/dev/null 2>&1
python3 .claude/skills/sore-asa-report/scripts/asa_qa.py ASA-<Client>-<YYYYMMDD>.docx
```
Le script imprime uniquement les anomalies (`ERREUR` bloquant, `ALERTE` à arbitrer). Corriger chacune,
relancer jusqu'à `0 ERREUR`. Ne lire du document que les passages cités.

## 2. Invariants de qualité (appris sur les engagements réels)
| Règle | Origine |
|---|---|
| Stealer logs → tier dédié « Urgence immédiate — sous 48 h », en tête des recommandations | Doctrine |
| Totaux du tableau de bord = totaux de la conclusion = même objet agrégé | Écarts constatés |
| Comptes d'actifs vérifiés ligne à ligne contre le tableau section 3 | Écarts constatés |
| « Confirmé par résolution DNS » ⇒ l'actif a une IP ; un actif « Non résolu » ne compte pas comme confirmé | RAM |
| IP issue d'un MX (Microsoft 365 EOP, Trend Micro…) ≠ « IP d'origine exposée » | Faux positif récurrent |
| Bucket cloud deviné par convention de nommage ⇒ « propriété non confirmée », pas un finding confirmé | Ora |
| Pas de texte de gabarit hors sujet (ex. note Let's Encrypt si tous les certificats sont Sectigo) | RAM |
| Références internes justes (« voir section X ») | RAM |
| Aucun vendor IA ; analyste = « Plateforme d'intelligence souveraine Sore Security » | Doctrine |
| Sources citées dans la méthodologie = sources réellement utilisées (VirusTotal, HudsonRock…) | Cohérence |

## 3. Format
- `.docx`, Calibri, charte navy/cyan, logo réel, sections 1 à 6.
- Nom : `ASA-[Client]-[YYYYMMDD]-[ID]-REV.docx`.
- Classification CONFIDENTIEL, destinataire unique en pied de page.
- Disclaimer passif/OSINT en tête du résumé ; « à confirmer » pour tout ce qui exige un scan actif.

## 4. Ton
Factuel, sans dramatisation ni promesse. La phrase commerciale de fin de résumé reste unique et sobre.
Délais exprimés de façon cohérente partout (si « sous 48 h » en section 5, pas « 24 à 48 h » ailleurs).
