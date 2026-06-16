// lib/sea-temp.ts

/**
 * Température de l'eau de la mer à Saint-Malo — MOYENNE SAISONNIÈRE par mois.
 *
 * Pourquoi pas une valeur « du jour » :
 *  - Les API marines sans/avec clé (Open-Meteo, Stormglass) lisent ~18-19° là où
 *    la réalité est ~13° : modèles à maille large qui ne résolvent pas l'eau
 *    côtière froide (estuaire de la Rance, brassage des marées).
 *  - Les sources mesurées précises (cabaigne, letelegramme…) sont derrière
 *    Cloudflare → 403 depuis une IP datacenter (Vercel), et toute automatisation
 *    serveur (Edge Function, cron) a le même problème d'IP.
 *
 * Donc on committe les moyennes mensuelles (même philosophie que `lib/tides.ts`) :
 * pas la valeur exacte du jour, mais le bon ordre de grandeur, stable, zéro
 * dépendance / quota / 403. Affiché « mer ~14° en juin ».
 *
 * Valeurs : moyennes mensuelles Saint-Malo, source cabaigne.net (relevés 2024-2026
 * lissés). Ré-ajustable une fois par an si besoin.
 */

// index 0 = janvier … 11 = décembre
const MONTHLY_AVG_C: readonly number[] = [
  9, // janvier
  8, // février
  8, // mars
  9, // avril
  12, // mai
  14, // juin
  16, // juillet
  17, // août
  18, // septembre
  16, // octobre
  14, // novembre
  11, // décembre
];

/** Moyenne saisonnière (°C) du mois donné (0-11), ou null si hors plage. */
export function getSeasonalWaterTemp(monthIndex: number): number | null {
  return MONTHLY_AVG_C[monthIndex] ?? null;
}
