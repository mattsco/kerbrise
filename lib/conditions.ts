// lib/conditions.ts

/**
 * Conditions du jour à Kerbrise (Le Val, Rothéneuf / Saint-Malo), pour enrichir
 * la bannière contextuelle du dashboard quand quelqu'un est sur place.
 *
 * Sources :
 *   - temp. mer    → moyenne saisonnière statique du mois (`lib/sea-temp.ts`).
 *                    Les API marines surestiment (~18-19° vs ~13°) et les sources
 *                    mesurées sont bloquées (Cloudflare 403 sur IP datacenter).
 *   - heures marée → scraper maree.info (PM/BM + hauteurs), filtrées sur le futur
 *   - coef marée   → coefficients committés dans `lib/tides.ts` (offline, le + sûr)
 *   - météo + coucher du soleil + tendance semaine → Open-Meteo Forecast
 *
 * ⚠️ Mode dégradé obligatoire. Chaque source échoue indépendamment → la donnée
 * vaut `null`/`[]` et la ligne disparaît. Le coef reste toujours dispo (statique).
 */

import { getTideDay, tideLevel, type TideLevel } from "./tides";
import { parseLocalDate } from "./dates";
import { getSaintMaloTidesSafe, type TideResponse } from "./maree-info";
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

export type TideTime = {
  type: "PM" | "BM";
  time: string;
  height: number | null;
};

export type WeatherNow = {
  minC: number;
  maxC: number;
  /** Écart de la max du jour vs hier (°C, arrondi). null si hier indispo. */
  deltaMaxC: number | null;
  /** Heure du coucher du soleil "22h03", ou null. */
  sunset: string | null;
  /** Phrase courte sur la tendance des 7 prochains jours, ou null. */
  weekSummary: string | null;
};

export type Conditions = {
  sea: SeaNow | null;
  tide: TideNow | null;
  /** Les 2 prochaines marées à venir (aujourd'hui puis demain si besoin). */
  upcomingTides: TideTime[];
  /** Toutes les marées d'aujourd'hui (PM/BM), passées comprises. */
  todayTides: TideTime[];
  weather: WeatherNow | null;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Minutes écoulées depuis minuit, en heure de Paris. */
function parisNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** "04h05" → 245 (minutes). null si format inattendu. */
function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2})h(\d{2})$/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

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

/** Tendance météo des 7 prochains jours, ton léger. Déterministe (pas de LLM). */
function weekSummary(codes: number[], maxes: number[]): string | null {
  if (codes.length === 0) return null;
  const rainy = codes.filter((c) => c >= 51 && c <= 99).length; // bruine → orage
  const clearish = codes.filter((c) => c <= 2).length; // dégagé / peu nuageux
  const avgMax =
    maxes.length > 0 ? maxes.reduce((a, b) => a + b, 0) / maxes.length : 0;

  if (rainy === 0 && avgMax >= 22)
    return "Grand beau et chaud toute la semaine, tu as de la chance ☀️";
  if (rainy === 0) return "Beau temps toute la semaine ☀️";
  if (rainy <= 1 && clearish >= 4) return "Surtout du soleil cette semaine";
  if (rainy >= 5) return "Semaine bien pluvieuse, prévois le ciré 🧥";
  if (rainy >= 3) return "Semaine en demi-teinte, soleil et pluie";
  return "Temps variable cette semaine";
}

async function getWeather(todayISO: string): Promise<WeatherNow | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunset` +
    `&past_days=1&forecast_days=7&timezone=Europe%2FParis`;

  const j = (await fetchJson(url)) as
    | {
        daily?: {
          time?: unknown[];
          temperature_2m_max?: unknown[];
          temperature_2m_min?: unknown[];
          weather_code?: unknown[];
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
  const codeArr = d?.weather_code ?? [];
  const sunsetArr = d?.sunset ?? [];

  const maxC = num(maxArr[todayIdx]);
  const minC = num(minArr[todayIdx]);
  if (maxC === null || minC === null) return null;

  const yMax = todayIdx > 0 ? num(maxArr[todayIdx - 1]) : null;
  const deltaMaxC = yMax === null ? null : Math.round(maxC - yMax);

  // 7 jours à partir d'aujourd'hui pour la tendance
  const weekCodes: number[] = [];
  const weekMaxes: number[] = [];
  for (let i = todayIdx; i < todayIdx + 7 && i < times.length; i++) {
    const c = num(codeArr[i]);
    const mx = num(maxArr[i]);
    if (c !== null) weekCodes.push(c);
    if (mx !== null) weekMaxes.push(mx);
  }

  return {
    minC: Math.round(minC),
    maxC: Math.round(maxC),
    deltaMaxC,
    sunset: isoTimeToHHhMM(sunsetArr[todayIdx]),
    weekSummary: weekSummary(weekCodes, weekMaxes),
  };
}

function getTide(todayISO: string): TideNow | null {
  const d = parseLocalDate(todayISO);
  const day = getTideDay(d.getFullYear(), d.getMonth(), d.getDate());
  if (!day) return null;
  return { coef: day.coef, raw: day.raw, level: tideLevel(day.coef) };
}

/**
 * Les 2 prochaines marées à partir de maintenant. Cherche dans aujourd'hui
 * (days[0]) puis demain (days[1]) — maree.info/52 liste aujourd'hui en tête.
 */
function upcomingTides(data: TideResponse | null): TideTime[] {
  const now = parisNowMinutes();
  const list: { sortKey: number; t: TideTime }[] = [];

  for (const offset of [0, 1]) {
    const day = data?.days?.[offset];
    if (!day?.events?.length) continue;
    for (const e of day.events) {
      const mins = timeToMinutes(e.time);
      if (mins === null) continue;
      const key = mins + offset * 1440;
      if (offset === 0 && mins < now) continue; // marée déjà passée
      list.push({
        sortKey: key,
        t: { type: e.type, time: e.time, height: num(e.height) },
      });
    }
  }

  list.sort((a, b) => a.sortKey - b.sortKey);
  return list.slice(0, 2).map((x) => x.t);
}

/** Toutes les marées d'aujourd'hui (PM/BM), passées comprises, dans l'ordre. */
function allTodayTides(data: TideResponse | null): TideTime[] {
  const day = data?.days?.[0];
  if (!day?.events?.length) return [];
  return day.events
    .filter((e) => timeToMinutes(e.time) !== null)
    .map((e) => ({ type: e.type, time: e.time, height: num(e.height) }));
}

/**
 * Récupère les conditions du jour. Sources réseau en parallèle, dégradation
 * indépendante. La marée (coef) est statique et synchrone.
 */
export async function getConditions(todayISO: string): Promise<Conditions> {
  const [tideData, weather] = await Promise.all([
    getSaintMaloTidesSafe(),
    getWeather(todayISO),
  ]);

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
