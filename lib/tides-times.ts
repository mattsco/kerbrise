// lib/tides-times.ts
//
// Horaires de marée (PM/BM + hauteur) committés offline, par année — le pendant
// horaire des coefficients de `lib/tides.ts`. Même philosophie : donnée
// déterministe, committée, zéro dépendance réseau au runtime.
//
// Pourquoi pas un scrape live : la source temps-réel (maree.info) bloque les IP
// datacenter → OK en local, vide en prod (Vercel). Cf. docs/guides/trmnl-plugin-guide.md §11.
//
// ⚠️ Convention jour civil : une pleine mer juste après minuit est rattachée au
// jour où elle a lieu (ex. 00h34 → ce jour-là). C'est volontairement différent du
// regroupement « jour de marée » des coefs de tides.ts pour ~28 marées limites de
// l'année — normal, et c'est la bonne convention pour afficher « les marées du jour ».

import { TIDE_TIMES_2026 } from "./data/tides-times-2026";

export type TideTimeEvent = {
  type: "PM" | "BM";
  /** Heure locale Europe/Paris, format "HHhMM" (ex. "04h42"). */
  time: string;
  /** Hauteur d'eau en mètres (zéro hydrographique). */
  height: number;
  /** Coefficient — uniquement sur les pleines mers (PM). */
  coef?: number;
};

export type OfflineTideDay = {
  /** Date ISO "yyyy-mm-dd". */
  date: string;
  events: readonly TideTimeEvent[];
};

/**
 * Forme volontairement compatible avec ce que `lib/conditions.ts` attendait du
 * scraper : `days[0]` = jour de référence, `days[1]` = lendemain (pour calculer
 * les 2 prochaines marées à cheval sur minuit).
 */
export type OfflineTides = {
  port: string;
  source: string;
  days: OfflineTideDay[];
};

const BY_YEAR: Record<number, Record<string, readonly TideTimeEvent[]>> = {
  2026: TIDE_TIMES_2026,
};

/** Années couvertes par les horaires committés, triées. */
export const TIDE_TIMES_YEARS: number[] = Object.keys(BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

/** Horaires d'un jour donné (ISO), ou null si non couvert. Dégrade proprement. */
export function getTideTimesDay(
  isoDate: string
): readonly TideTimeEvent[] | null {
  const year = Number(isoDate.slice(0, 4));
  return BY_YEAR[year]?.[isoDate] ?? null;
}

/** "2026-12-31" → "2027-01-01". Calcul en UTC pour éviter tout décalage TZ. */
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Construit le bloc marées offline pour `todayISO` (+ lendemain si dispo).
 * `null` si le jour n'est pas couvert → la carte masque les lignes marée
 * (mode dégradé identique à l'ancien scraper).
 */
export function getOfflineTides(todayISO: string): OfflineTides | null {
  const today = getTideTimesDay(todayISO);
  if (!today) return null;

  const days: OfflineTideDay[] = [{ date: todayISO, events: today }];
  const tomISO = addDaysISO(todayISO, 1);
  const tom = getTideTimesDay(tomISO);
  if (tom) days.push({ date: tomISO, events: tom });

  return {
    port: "Saint-Malo",
    source: "saint-malo-tourisme.co.uk (offline)",
    days,
  };
}

// ---------------------------------------------------------------------------
// Garde-fou dev : repère un jour mal formé (horaires non croissants / type
// dupliqué). Silencieux en prod.
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== "production") {
  for (const [y, byDate] of Object.entries(BY_YEAR)) {
    for (const [date, evs] of Object.entries(byDate)) {
      const mins = evs.map(
        (e) => Number(e.time.slice(0, 2)) * 60 + Number(e.time.slice(3))
      );
      const sorted = [...mins].sort((a, b) => a - b);
      if (mins.some((v, i) => v !== sorted[i])) {
        // eslint-disable-next-line no-console
        console.error(`[tides-times] ${date} (${y}) : horaires non croissants`, evs);
      }
    }
  }
}
