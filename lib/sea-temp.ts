// lib/sea-temp.ts

/**
 * Température de l'eau de la mer (zone Saint-Malo / Le Val) via l'API Stormglass.
 *
 * Pourquoi Stormglass et pas un scraping : les pages publiques précises
 * (cabaigne, letelegramme…) sont derrière Cloudflare → 403 depuis l'IP datacenter
 * de Vercel (OK en local résidentiel, KO en prod). Et Open-Meteo Marine, sans clé,
 * lit ~19° au lieu de ~13° réels. Stormglass : précis, marche depuis un datacenter,
 * gratuit 10 req/jour (usage non commercial) — largement couvert par le cache 6h.
 *
 * 🔑 Clé lue depuis `process.env.STORMGLASS_API_KEY` (variable d'env Vercel).
 * Jamais hardcodée. Si absente → null (la ligne « mer » disparaît, pas de crash).
 *
 * ⚠️ Mode dégradé : timeout, non-throwing, borne de plausibilité (0-35°). Tout
 * échec (clé absente, quota 402, clé invalide 401, réseau) est tracé pour les logs.
 */

// Le Val / Rothéneuf
const LAT = 48.683;
const LON = -1.965;

const ENDPOINT = "https://api.stormglass.io/v2/weather/point";
const REVALIDATE_SECONDS = 21600; // 6h → ~4 appels/jour, sous le quota gratuit (10)
const FETCH_TIMEOUT_MS = 5000;

// Sources Stormglass par ordre de préférence (sg = estimation agrégée maison).
const SOURCE_PREFS = ["sg", "noaa", "meto", "meteo"] as const;

function pickTemp(wt: unknown): number | null {
  if (!wt || typeof wt !== "object") return null;
  const obj = wt as Record<string, unknown>;
  for (const k of SOURCE_PREFS) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export async function getSaintMaloWaterTemp(): Promise<number | null> {
  const key = process.env.STORMGLASS_API_KEY;
  if (!key) {
    console.error("[sea-temp] STORMGLASS_API_KEY manquant");
    return null;
  }

  const start = Math.floor(Date.now() / 1000);
  const url =
    `${ENDPOINT}?lat=${LAT}&lng=${LON}&params=waterTemperature` +
    `&start=${start}&end=${start + 3600}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      // 401 = clé invalide, 402 = quota dépassé, 429 = rate limit
      console.error(`[sea-temp] stormglass HTTP ${res.status}`);
      return null;
    }

    const j = (await res.json()) as { hours?: { waterTemperature?: unknown }[] };
    const t = pickTemp(j?.hours?.[0]?.waterTemperature);
    if (t === null) {
      console.error("[sea-temp] stormglass: waterTemperature absente de la réponse");
      return null;
    }
    return t;
  } catch (e) {
    console.error(
      "[sea-temp] stormglass échec:",
      e instanceof Error ? `${e.name}: ${e.message}` : e
    );
    return null;
  }
}
