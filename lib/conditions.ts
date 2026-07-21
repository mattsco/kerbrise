// lib/conditions.ts

/**
 * Conditions du jour à Kerbrise (Le Val, Rothéneuf / Saint-Malo), pour enrichir
 * la bannière contextuelle du dashboard quand quelqu'un est sur place.
 *
 * Sources :
 *   - temp. mer    → moyenne saisonnière statique du mois (`lib/sea-temp.ts`).
 *                    Les API marines surestiment (~18-19° vs ~13°) et les sources
 *                    mesurées sont bloquées (Cloudflare 403 sur IP datacenter).
 *   - heures marée → horaires committés offline (`lib/tides-times.ts`), filtrés
 *                    sur le futur. Plus de scrape maree.info (bloqué sur IP
 *                    datacenter → vide en prod). Cf. guide TRMNL §11.
 *   - coef marée   → coefficients committés dans `lib/tides.ts` (offline, le + sûr)
 *   - météo + coucher du soleil → Open-Meteo Forecast
 *
 * ⚠️ Mode dégradé obligatoire. Chaque source échoue indépendamment → la donnée
 * vaut `null`/`[]` et la ligne disparaît. Le coef reste toujours dispo (statique).
 */

import { getTideDay, tideLevel, type TideLevel } from "./tides";
import { parseLocalDate } from "./dates";
import {
  getOfflineTides,
  upcomingTides,
  allTodayTides,
  type TideTime,
} from "./tides-times";
import { getSeasonalWaterTemp } from "./sea-temp";

// Le Val / Rothéneuf
const LAT = 48.683;
const LON = -1.965;

const REVALIDATE_SECONDS = 7200; // Open-Meteo caché 2h
const FETCH_TIMEOUT_MS = 4000;

export type SeaNow = {
  tempC: number;
};

export type TideNow = {
  coef: number;
  raw: number[];
  level: TideLevel;
};

/** Ré-exporté pour ne pas casser les imports existants (api/term, bannière). */
export type { TideTime } from "./tides-times";

export type WeatherNow = {
  minC: number;
  maxC: number;
  /** Écart de la moyenne du jour vs la normale du mois (°C, arrondi). */
  deltaVsNormalC: number | null;
  /** Heure du coucher du soleil "22h03", ou null. */
  sunset: string | null;
};

// Normales mensuelles de température MOYENNE de l'air à Saint-Malo (°C, index
// 0=janvier). Climatologie station Dinard/Saint-Malo, lissée. Base stable pour
// « +X° vs la normale » — évite la comparaison à la veille (valeur de grille
// volatile, non représentative du bord de mer).
const NORMAL_MEAN_C: readonly number[] = [
  7, 7, 8, 10, 13, 16, 18, 18, 16, 13, 10, 7,
];

export type Conditions = {
  sea: SeaNow | null;
  tide: TideNow | null;
  /** Les 2 prochaines marées à venir (aujourd'hui puis demain si besoin). */
  upcomingTides: TideTime[];
  /** Toutes les marées d'aujourd'hui (PM/BM), passées comprises. */
  todayTides: TideTime[];
  weather: WeatherNow | null;
};

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** "2026-06-15T22:03" → "22h03". null si format inattendu. */
function isoTimeToHHhMM(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}h${m[2]}` : null;
}

async function getWeather(todayISO: string): Promise<WeatherNow | null> {
  // Pas de past_days : on ne compare plus à hier (valeur de grille volatile, p.ex.
  // un 15 juin à 28° dans la cellule alors que la plage était à ~21°). On compare
  // la MOYENNE du jour à la normale saisonnière du mois (base stable).
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,sunset` +
    `&forecast_days=1&timezone=Europe%2FParis`;

  const j = (await fetchJson(url)) as
    | {
        daily?: {
          time?: unknown[];
          temperature_2m_max?: unknown[];
          temperature_2m_min?: unknown[];
          temperature_2m_mean?: unknown[];
          sunset?: unknown[];
        };
      }
    | null;

  const d = j?.daily;
  const times = Array.isArray(d?.time) ? (d!.time as unknown[]) : [];
  const todayIdx = times.indexOf(todayISO);
  if (todayIdx < 0) return null;

  const maxArr = d?.temperature_2m_max ?? [];
  const minArr = d?.temperature_2m_min ?? [];
  const meanArr = d?.temperature_2m_mean ?? [];
  const sunsetArr = d?.sunset ?? [];

  const maxC = num(maxArr[todayIdx]);
  const minC = num(minArr[todayIdx]);
  if (maxC === null || minC === null) return null;

  // Moyenne du jour (vraie moyenne Open-Meteo, sinon (min+max)/2) vs normale du mois.
  const meanC = num(meanArr[todayIdx]) ?? (maxC + minC) / 2;
  const normal = NORMAL_MEAN_C[parseLocalDate(todayISO).getMonth()];
  const deltaVsNormalC =
    normal === undefined ? null : Math.round(meanC - normal);

  return {
    minC: Math.round(minC),
    maxC: Math.round(maxC),
    deltaVsNormalC,
    sunset: isoTimeToHHhMM(sunsetArr[todayIdx]),
  };
}

/** Garde un nombre fini, sinon null. Utilisé par le parsing météo. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function getTide(todayISO: string): TideNow | null {
  const d = parseLocalDate(todayISO);
  const day = getTideDay(d.getFullYear(), d.getMonth(), d.getDate());
  if (!day) return null;
  return { coef: day.coef, raw: day.raw, level: tideLevel(day.coef) };
}

/**
 * Récupère les conditions du jour. Sources réseau en parallèle, dégradation
 * indépendante. La marée (coef) est statique et synchrone.
 */
export async function getConditions(todayISO: string): Promise<Conditions> {
  // Horaires marée : statiques (committés), synchrones. Plus de scrape réseau.
  // Météo : seule source réseau restante, dégradation indépendante.
  const tideData = getOfflineTides(todayISO);
  const weather = await getWeather(todayISO);

  // Temp. mer : moyenne saisonnière du mois (statique, cf. sea-temp.ts)
  const t = getSeasonalWaterTemp(parseLocalDate(todayISO).getMonth());
  const sea: SeaNow | null = t !== null ? { tempC: t } : null;

  return {
    sea,
    tide: getTide(todayISO),
    upcomingTides: upcomingTides(tideData),
    todayTides: allTodayTides(tideData),
    weather,
  };
}
