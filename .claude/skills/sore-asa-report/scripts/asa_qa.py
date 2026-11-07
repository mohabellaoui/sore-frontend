#!/usr/bin/env python3
"""QA automatique d'un rapport ASA Sore Security (.docx).

N'imprime que les anomalies : ERREUR (bloquant) / ALERTE (à arbitrer).
Usage : python3 asa_qa.py rapport.docx
"""
import re
import sys
import unicodedata
from collections import Counter

try:
    import docx
except ImportError:
    sys.exit("python-docx requis : pip install python-docx")

VENDORS = r"\b(Anthropic|Claude|Groq|Gemini|OpenAI|ChatGPT|GPT-?\d|Llama|Meta AI|Mistral)\b"
LEVELS = ["CRITIQUE", "ELEVE", "MOYEN", "FAIBLE", "INFO"]


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).upper()


def load(path):
    d = docx.Document(path)
    paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    tables = []
    for t in d.tables:
        rows = []
        for r in t.rows:
            cells = []
            for c in r.cells:
                txt = c.text.strip()
                if not cells or cells[-1] != txt:  # cellules fusionnées répétées
                    cells.append(txt)
            rows.append(cells)
        tables.append(rows)
    full = "\n".join(paras + ["\n".join(" | ".join(r) for r in t) for t in tables])
    return paras, tables, full


def find_table(tables, *headers):
    hs = [norm(h) for h in headers]
    for t in tables:
        if t and all(any(h in norm(c) for c in t[0]) for h in hs):
            return t
    return None


def main(path):
    paras, tables, full = load(path)
    F = norm(full)
    issues = []

    def err(m): issues.append(("ERREUR", m))
    def warn(m): issues.append(("ALERTE", m))

    # 1. White-label
    for m in sorted(set(re.findall(VENDORS, full))):
        err(f"Nom de vendor IA présent : « {m} »")

    # 2. Tableau surface d'attaque
    surf = find_table(tables, "Actif", "IP", "Risque")
    resolved, unresolved = [], []
    if surf:
        hdr = [norm(c) for c in surf[0]]
        ip_i = next(i for i, h in enumerate(hdr) if h == "IP")
        src_i = next((i for i, h in enumerate(hdr) if "SOURCE" in h), None)
        for r in surf[1:]:
            if len(r) <= ip_i:
                continue
            ip = r[ip_i]
            src = norm(r[src_i]) if src_i is not None and len(r) > src_i else ""
            if re.match(r"^\d{1,3}(\.\d{1,3}){3}$|:", ip):
                resolved.append(r[0])
            elif src == "DNS":
                unresolved.append(r[0])
        total_rows = len(surf) - 1
        # comptes annoncés dans le texte
        for m in re.finditer(r"(\d+) actifs? (?:confirm\w*|identifi\w*) par r[ée]solution DNS", full):
            n = int(m.group(1))
            if n != len(resolved):
                err(f"Texte : « {m.group(0)} » mais {len(resolved)} actif(s) ont réellement une IP "
                    f"({', '.join(resolved)}). Source DNS non résolue : {', '.join(unresolved) or 'aucune'}")
        for m in re.finditer(r"(\d+) cibles identifi", full):
            if int(m.group(1)) != total_rows:
                err(f"Texte annonce {m.group(1)} cibles, tableau section 3 : {total_rows} lignes")
        counts = Counter(re.findall(r"(\d+) actifs? (?:confirm|identifi)", full))
        if len(counts) > 1:
            warn(f"Comptes d'actifs incohérents dans le texte : {dict(counts)}")
    else:
        warn("Tableau « Surface d'attaque » (Actif / IP / Risque) introuvable")

    # 3. Cohérence findings : section 5 vs score global vs conclusion
    sev_count = Counter()
    tier_re = re.compile(r"(\d+) actions? (critique|[ée]lev[ée]e?s?|moyennes?|de bonnes pratiques|informati\w*|[àa] traiter avant)", re.I)
    for p in paras:
        m = tier_re.search(p)
        if m:
            k = norm(m.group(2))
            key = ("CRITIQUE" if ("CRITIQUE" in k or "TRAITER" in k) else
                   "ELEVE" if "ELEV" in k else "MOYEN" if "MOYEN" in k else "INFO")
            sev_count[key] += int(m.group(1))
    score = re.search(r"Critique\s*:\s*(\d+).*?[ÉE]lev[ée]\s*:\s*(\d+).*?Moyen\s*:\s*(\d+).*?Info\s*:\s*(\d+)", full, re.S)
    if score:
        sc = dict(zip(["CRITIQUE", "ELEVE", "MOYEN", "INFO"], map(int, score.groups())))
        for k, v in sc.items():
            if sev_count and sev_count.get(k, 0) != v:
                err(f"Score global {k}={v} mais section 5 annonce {sev_count.get(k, 0)}")
        concl = re.search(r"(\d+) findings?.*?(\d+) critiques?, (\d+) [ée]lev[ée]s?, (\d+) moyens?, (\d+) informati", full, re.S)
        if concl:
            tot, c, e, m_, i = map(int, concl.groups())
            if (c, e, m_, i) != (sc["CRITIQUE"], sc["ELEVE"], sc["MOYEN"], sc["INFO"]):
                err("Conclusion ≠ score global (comptes par sévérité)")
            if tot != c + e + m_ + i:
                err(f"Conclusion : total {tot} ≠ somme {c+e+m_+i}")
    else:
        warn("Bloc « SCORE DE RISQUE GLOBAL » non détecté")

    # 4. Stealer logs → tier 48h
    if re.search(r"stealer|infostealer", full, re.I):
        if not re.search(r"URGENCE IMM[ÉE]DIATE", F.replace("É", "E")):
            err("Stealer logs présents mais pas de tier « URGENCE IMMÉDIATE — sous 48 h »")
        delays = set(re.findall(r"sous (\d+(?: [àa] \d+)?) ?h", full))
        if len(delays) > 1:
            warn(f"Délais d'urgence formulés différemment : {sorted(delays)} — harmoniser")
        st = find_table(tables, "Indicateur", "Valeur")
        if st:
            vals = {norm(r[0]): r[-1] for r in st[1:] if len(r) >= 2}
            for k, v in vals.items():
                if ("FAMILLE" in k or "DERNIERE" in k) and v.strip() in {"—", "-", ""}:
                    warn(f"Stealer logs : champ « {k.title()} » vide — renseigner ou retirer la ligne")

    # 5. Faux positifs connus
    if re.search(r"IP d.origine expos", full, re.I) and re.search(r"\bmx\b|Exchange Online|Trend Micro", full, re.I):
        warn("« IP d'origine exposée » + présence MX/EOP/Trend Micro : vérifier qu'aucune IP de relais mail n'est classée origine")
    if re.search(r"bucket|stockage cloud", full, re.I) and not re.search(r"non confirm", full, re.I) \
            and not re.search(r"Aucun bucket", full, re.I):
        warn("Finding stockage cloud sans mention « propriété non confirmée »")

    # 6. Texte de gabarit hors sujet
    tls = find_table(tables, "Domaine", "metteur")
    if tls:
        real_issuers = {r[1] for r in tls[1:] if len(r) > 1}
        if re.search(r"Let.s\s*Encrypt", full) and not any("Encrypt" in i or "Google" in i for i in real_issuers):
            warn(f"Note Let's Encrypt/Google Trust présente alors que les émetteurs sont : {', '.join(sorted(real_issuers))}")
        statuses = {norm(r[-1]) for r in tls[1:] if r}
        if re.search(r"A SURVEILLER", F) and not any("SURVEILLER" in s or "MOYEN" in s for s in statuses):
            warn("Texte renvoie aux certificats « À SURVEILLER » mais aucun certificat n'a ce statut")

    # 7. Références internes
    for m in re.finditer(r"voir (?:la )?(?:recommandation en t[êe]te de )?section (\d+)([a-z]?)", full, re.I):
        sec = m.group(1) + m.group(2)
        if not re.search(rf"(^|\n){sec}\.? ", full):
            warn(f"Référence « {m.group(0)} » : section {sec} introuvable")
    # Sévérité stealer cohérente avec le tier
    if re.search(r"Stealer", full, re.I) and re.search(r"S[ée]v[ée]rit[ée]\s*\|\s*MOYEN", full) \
            and re.search(r"URGENCE IMM", F.replace("É", "E")):
        warn("Stealer logs : sévérité « MOYEN » dans 4l mais traité en Critique en section 5 — "
             "justification présente ? (sinon aligner)")

    # 7b. Sources méthodologie vs sources utilisées
    meth = find_table(tables, "Champ", "Detail")
    if meth:
        src_row = next((r[-1] for r in meth[1:] if "SOURCE" in norm(r[0])), "")
        for name, pat in [("VirusTotal", r"VirusTotal"), ("HudsonRock / stealer logs", r"stealer"),
                          ("HIBP", r"HIBP"), ("Typosquatting", r"typosquat")]:
            if re.search(pat, full, re.I) and not re.search(pat, src_row, re.I):
                warn(f"Méthodologie : source « {name} » utilisée mais absente de la ligne Sources")

    # 8. Pagination / divers
    pages = re.findall(r"Page (\d+) ?/ ?(\d+)", full)
    if pages:
        warn(f"Pagination en texte statique ({pages[0][0]}/{pages[0][1]}) — utiliser un champ PAGE/NUMPAGES")
    if re.search(r"R[ée]putation\s*\|\s*0/100", full):
        warn("Réputation VirusTotal « 0/100 » ambiguë (0 = neutre chez VT) — reformuler")
    for p in paras:
        if re.search(r"\b(\w+) \1\b", p, re.I) and not re.search(r"\b(\d+) \1\b", p):
            w = re.search(r"\b(\w+) \1\b", p, re.I).group(0)
            if len(w) > 3:
                warn(f"Mot doublé : « {w} »")

    # Sortie
    issues = list(dict.fromkeys(issues))
    e = sum(1 for k, _ in issues if k == "ERREUR")
    a = len(issues) - e
    for k, m in issues:
        print(f"{k:7} {m}")
    print(f"\n{e} ERREUR · {a} ALERTE · actifs avec IP : {len(resolved)}")
    return 1 if e else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
