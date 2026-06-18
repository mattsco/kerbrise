#!/usr/bin/env python3
"""
Génère garmin/kerbrise-tides/source/TideData.mc à partir des horaires marées
committés (lib/data/tides-times-<ANNÉE>.ts).

Pourquoi packé : le FR255 a un budget mémoire serré. On encode chaque jour sur
32 caractères fixes (4 marées max × 8 chars), indexé par jour de l'année →
lookup O(1) sans parsing JSON.

Format d'une marée (8 chars) : [T][HHMM][CCC]
  T   = 'H' (pleine mer / PM) | 'L' (basse mer / BM) | '-' (pas de marée)
  HHMM = heure locale Europe/Paris, ex "1718" ; "----" si absente.
  CCC = coefficient (pleines mers uniquement), ex "074" ; "---" si absent.

Refresh annuel : régénérer lib/data/tides-times-<ANNÉE>.ts (cf. scripts/tides/
generate.py) puis relancer : python3 scripts/garmin/generate_tide_data.py <ANNÉE>
"""
import re
import sys
from pathlib import Path

YEAR = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "lib" / "data" / f"tides-times-{YEAR}.ts"
OUT = ROOT / "garmin" / "kerbrise-tides" / "source" / "TideData.mc"

# coef capturé s'il est présent dans le même objet { ... } (sans franchir le '}').
EVENT_RE = re.compile(
    r'type:\s*"(PM|BM)"\s*,\s*time:\s*"(\d{2})h(\d{2})"(?:[^}]*?coef:\s*(\d+))?'
)
DAY_RE = re.compile(r'"(\d{4})-(\d{2})-(\d{2})"\s*:\s*\[(.*?)\]\s*,?\s*$')

MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
SLOT = 8  # chars par marée
DAYW = 4 * SLOT  # chars par jour


def is_leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def day_of_year(month: int, day: int, leap: bool) -> int:
    doy = day
    for m in range(1, month):
        doy += MONTH_DAYS[m - 1]
        if m == 2 and leap:
            doy += 1
    return doy  # 1-based


def pack_events(body: str) -> str:
    out = ""
    n = 0
    for m in EVENT_RE.finditer(body):
        kind, hh, mm, coef = m.group(1), m.group(2), m.group(3), m.group(4)
        ccc = f"{int(coef):03d}" if coef else "---"
        out += ("H" if kind == "PM" else "L") + hh + mm + ccc
        n += 1
        if n == 4:
            break
    while n < 4:
        out += "-" * SLOT
        n += 1
    return out


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    leap = is_leap(YEAR)
    n_days = 366 if leap else 365
    days = ["-" * DAYW] * n_days

    found = 0
    for line in text.splitlines():
        m = DAY_RE.search(line.strip())
        if not m:
            continue
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y != YEAR:
            continue
        days[day_of_year(mo, d, leap) - 1] = pack_events(m.group(4))
        found += 1

    if found < n_days - 15:
        print(f"⚠️  Seulement {found}/{n_days} jours trouvés — vérifier la source.",
              file=sys.stderr)

    packed = "".join(days)
    assert len(packed) == n_days * DAYW, f"longueur inattendue: {len(packed)}"

    chunks = [packed[i:i + 80] for i in range(0, len(packed), 80)]
    joined = "\n        + ".join(f'"{c}"' for c in chunks)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        f'''// garmin/kerbrise-tides/source/TideData.mc
//
// GÉNÉRÉ par scripts/garmin/generate_tide_data.py — NE PAS ÉDITER À LA MAIN.
// Horaires marées Saint-Malo {YEAR}, packés (cf. en-tête du script générateur).
// Source : lib/data/tides-times-{YEAR}.ts (office de tourisme Saint-Malo).

using Toybox.Lang;

module TideData {{
    // Année couverte par DATA. Hors de cette année → pas de données.
    const YEAR = {YEAR};

    // {DAYW} chars par jour, indexés par (jour de l'année - 1).
    // Marée (8 chars) = [H|L|-] + HHMM + CCC (coef, PM seulement, sinon "---").
    const DATA =
        {joined};

    // Renvoie les marées d'un jour (1..366) : tableau de
    // [ "H"|"L", heures(int), minutes(int), coef(int) ou null ].
    function dayEvents(year as Lang.Number, doy as Lang.Number) as Lang.Array {{
        var events = [];
        if (year != YEAR) {{ return events; }}
        var base = (doy - 1) * {DAYW};
        if (base < 0 || base + {DAYW} > DATA.length()) {{ return events; }}
        for (var i = 0; i < 4; i++) {{
            var off = base + i * {SLOT};
            var t = DATA.substring(off, off + 1);
            if (!t.equals("H") && !t.equals("L")) {{ continue; }}
            var hh = DATA.substring(off + 1, off + 3).toNumber();
            var mm = DATA.substring(off + 3, off + 5).toNumber();
            if (hh == null || mm == null) {{ continue; }}
            var cs = DATA.substring(off + 5, off + 8);
            var coef = cs.equals("---") ? null : cs.toNumber();
            events.add([t, hh, mm, coef]);
        }}
        return events;
    }}
}}
''',
        encoding="utf-8",
    )
    print(f"✅ {OUT.relative_to(ROOT)} — {found} jours, {len(packed)} chars packés.")


if __name__ == "__main__":
    main()
