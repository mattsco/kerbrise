#!/usr/bin/env python3
"""
Génère lib/data/tides-times-<ANNÉE>.ts à partir d'un dump brut des tables marées
de l'office de tourisme de Saint-Malo.

Pourquoi : la donnée marée est déterministe → committée offline (pas de scrape
runtime ; maree.info bloque les IP datacenter). Cf. docs/guides/trmnl-plugin-guide.md §11.

Refresh annuel (ex. 2027) :
  1. Ouvrir https://www.saint-malo-tourisme.co.uk/pack-your-bags/practical-information/tides/
  2. Copier les 12 tables mensuelles dans scripts/tides/tides-<ANNÉE>-raw.txt,
     en préfixant chaque mois par une ligne "MONTH=NN" (cf. le fichier 2026).
  3. python3 scripts/tides/generate.py <ANNÉE>
  4. Ajouter TIDE_TIMES_<ANNÉE> dans le registre BY_YEAR de lib/tides-times.ts.

Validation intégrée : la séquence chronologique des coefs de PM extraits doit être
identique à RAW_BY_YEAR[ANNÉE] de lib/tides.ts (même source de prédiction). Toute
divergence (hors 2 derniers, tolérés si le dump est tronqué) arrête la génération.
"""
import re, json, sys
from pathlib import Path

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ROOT = Path(__file__).resolve().parents[2]
RAW = Path(__file__).resolve().parent / f"tides-{YEAR}-raw.txt"
TIDES_TS = ROOT / "lib" / "tides.ts"
OUT_TS = ROOT / "lib" / "data" / f"tides-times-{YEAR}.ts"

# 1. Coefs committés de l'année (cross-validation)
src = TIDES_TS.read_text(encoding="utf-8")
i = src.index(f"{YEAR}:"); i = src.index("[", i)
depth, j = 0, i
while j < len(src):
    if src[j] == "[": depth += 1
    elif src[j] == "]":
        depth -= 1
        if depth == 0:
            j += 1; break
    j += 1
block = re.sub(r"/\*.*?\*/", "", src[i:j])
block = re.sub(r",(\s*[\]])", r"\1", block)
coefs = json.loads(block)

# 2. Parse du dump brut
CELL_TIME  = re.compile(r"(\d{2}):(\d{2})")
CELL_ARROW = re.compile(r"([⬆⬇])")
CELL_H     = re.compile(r"([\d.]+)\s*m")
CELL_COEF  = re.compile(r"Coef\s*(\d+)")

events_by_date, errors, month = {}, [], None
for line in RAW.read_text(encoding="utf-8").splitlines():
    m = re.match(r"MONTH=(\d+)", line)
    if m:
        month = int(m.group(1)); continue
    if not line.startswith("|"):
        continue
    cols = [c.strip() for c in line.split("|")]
    dm = re.search(r"(\d{2})\s*$", cols[1])
    if not dm:
        continue
    day, evs = int(dm.group(1)), []
    for cell in cols[2:7]:
        if not cell.strip():
            continue
        tm, am = CELL_TIME.search(cell), CELL_ARROW.search(cell)
        if not tm or not am:
            errors.append(f"{month:02d}-{day:02d}: cellule illisible: {cell!r}"); continue
        hm = CELL_H.search(cell)
        ev = {"type": "PM" if am.group(1) == "⬆" else "BM",
              "time": f"{tm.group(1)}h{tm.group(2)}",
              "height": float(hm.group(1)) if hm else None}  # hauteur parfois absente
        cm = CELL_COEF.search(cell)
        if cm:
            ev["coef"] = int(cm.group(1))
        evs.append(ev)
    events_by_date[f"{YEAR}-{month:02d}-{day:02d}"] = evs

# 3a. cohérence par jour
for date, evs in events_by_date.items():
    mins = [int(e["time"][:2]) * 60 + int(e["time"][3:]) for e in evs]
    if mins != sorted(mins):
        errors.append(f"{date}: horaires non croissants")
    types = [e["type"] for e in evs]
    if any(a == b for a, b in zip(types, types[1:])):
        errors.append(f"{date}: deux marées de même type consécutives: {types}")
    for e in evs:
        if e["height"] is not None and not 0 <= e["height"] <= 14:
            errors.append(f"{date}: hauteur invraisemblable {e['height']}")

# 3b. séquence chronologique des coefs PM == coefs committés
T = [e["coef"] for d in sorted(events_by_date)
     for e in events_by_date[d] if e["type"] == "PM" and "coef" in e]
last = sorted(events_by_date)[-1]
lm, ld = int(last[5:7]), int(last[8:10])
C = []
for mi in range(12):
    for di in range(len(coefs[mi])):
        if (mi + 1, di + 1) > (lm, ld):
            break
        C.extend(coefs[mi][di])
    if mi + 1 > lm:
        break
n = min(len(T), len(C))
div = next((k for k in range(n) if T[k] != C[k]), None)
if div is not None and div < n - 2:
    errors.append(f"séquence coefs PM diverge à #{div}: {T[div:div+4]} vs committé {C[div:div+4]}")

days = sorted(events_by_date)
print(f"{YEAR}: {len(days)} jours {days[0]}..{days[-1]}, "
      f"{sum(len(v) for v in events_by_date.values())} marées, "
      f"coefs PM {len(T)}/{len(C)} divergence={div}")
if errors:
    print(f"\n!!! {len(errors)} ANOMALIES (génération annulée):")
    for e in errors[:60]:
        print("  ", e)
    sys.exit(1)

# 4. Émission TS
out = [
    f"// lib/data/tides-times-{YEAR}.ts",
    "//",
    f"// Horaires de marée Saint-Malo {YEAR} (PM/BM + hauteur), committés offline.",
    "// GÉNÉRÉ par scripts/tides/generate.py — ne pas éditer à la main.",
    "// Source : office de tourisme Saint-Malo. Coefs PM validés == RAW_BY_YEAR de lib/tides.ts.",
    "",
    'import type { TideTimeEvent } from "@/lib/tides-times";',
    "",
    f"export const TIDE_TIMES_{YEAR}: Record<string, readonly TideTimeEvent[]> = {{",
]
for date in days:
    parts = []
    for e in events_by_date[date]:
        h = "null" if e["height"] is None else e["height"]
        seg = f'{{ type: "{e["type"]}", time: "{e["time"]}", height: {h}'
        if "coef" in e:
            seg += f', coef: {e["coef"]}'
        parts.append(seg + " }")
    out.append(f'  "{date}": [{", ".join(parts)}],')
out += ["};", ""]
OUT_TS.write_text("\n".join(out), encoding="utf-8")
print(f"Écrit {OUT_TS.relative_to(ROOT)}")
