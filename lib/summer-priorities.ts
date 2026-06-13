/**
 * Système de priorités pour les périodes d'été (juillet/août) à Kerbrise.
 * Rotation modulo 3 démarrant en 2024.
 *
 *   2024 : Antoine (1), Vincent (2), François (3)
 *   2025 : Vincent (1), François (2), Antoine (3)
 *   2026 : François (1), Antoine (2), Vincent (3)
 *   2027 : Antoine (1), ... (cycle)
 *
 * DATES DES PÉRIODES — deux modèles selon l'année :
 *
 *  • Legacy (≤ 2026) : dates fixes de SUMMER_PERIODS. end_date = dernier jour
 *    occupé (inclusif), périodes NON jointives (P1 finit le 19, P2 démarre le 20).
 *
 *  • Pivot (≥ 2027) : la famille vote le début de P1 dans SUMMER_PERIOD_1_START
 *    (lib/config.ts). Chaque période dure 21 jours. end_date(Pn) = start_date(Pn+1)
 *    = JOUR PIVOT (départ d'une famille = arrivée de la suivante, semi-ouvert [)).
 *    Le pivot tombe donc toujours le même jour de semaine que le début de P1,
 *    et les trois familles ont exactement 21 jours chacune.
 */

import { FAMILIES, type FamilyName } from "./families";
import { SUMMER_PERIOD_1_START } from "./config";
import { addDays, parseLocalDate } from "./dates";

export type { FamilyName };

export const SUMMER_PERIODS = [
  {
    id: 1,
    startMonth: 6,
    startDay: 29,
    endMonth: 7,
    endDay: 19,
    label: "Période 1",
    // ⚠️ description = legacy ≤2026 uniquement. Faux pour ≥2027 → getPeriodRangeLabel().
    description: "29 juin → 19 juillet",
  },
  {
    id: 2,
    startMonth: 7,
    startDay: 20,
    endMonth: 8,
    endDay: 9,
    label: "Période 2",
    description: "20 juillet → 9 août",
  },
  {
    id: 3,
    startMonth: 8,
    startDay: 10,
    endMonth: 8,
    endDay: 31,
    label: "Période 3",
    description: "10 août → 31 août",
  },
] as const;

export type SummerPeriod = (typeof SUMMER_PERIODS)[number];

/** Durée d'une période dans le modèle pivot (3 semaines pleines). */
const PERIOD_DURATION_DAYS = 21;

/**
 * Première année gérée par le modèle pivot = plus petite clé votée.
 * En dessous : legacy (dates fixes). Table vide → tout reste legacy.
 */
const FIRST_PIVOT_YEAR = Object.keys(SUMMER_PERIOD_1_START).length
  ? Math.min(...Object.keys(SUMMER_PERIOD_1_START).map(Number))
  : Infinity;

/**
 * true si l'année est calculable : legacy (< FIRST_PIVOT_YEAR) ou date votée
 * présente. L'UI DOIT tester ceci avant d'afficher les périodes d'une année :
 * si false → on n'affiche rien (pas de date votée, on n'invente pas de période).
 */
export function isSummerYearConfigured(year: number): boolean {
  return year < FIRST_PIVOT_YEAR || year in SUMMER_PERIOD_1_START;
}

/**
 * Retourne les familles classées par priorité pour une année donnée.
 */
export function getYearPriorities(year: number): {
  1: FamilyName;
  2: FamilyName;
  3: FamilyName;
} {
  const offset = (((year - 2024) % 3) + 3) % 3;
  return {
    1: FAMILIES[offset].name,
    2: FAMILIES[(offset + 1) % 3].name,
    3: FAMILIES[(offset + 2) % 3].name,
  };
}

/**
 * Retourne la priorité d'une famille pour une année donnée (1, 2 ou 3).
 */
export function getFamilyPriority(
  year: number,
  familyName: string
): number | null {
  const priorities = getYearPriorities(year);
  if (priorities[1] === familyName) return 1;
  if (priorities[2] === familyName) return 2;
  if (priorities[3] === familyName) return 3;
  return null;
}

/**
 * Convertit une période + année en dates ISO (YYYY-MM-DD).
 *
 * ≥2027 (pivot)  : start = date votée + 21·(id-1) ; end = start + 21.
 *                  → end = JOUR PIVOT = début de la période suivante (semi-ouvert).
 * ≤2026 (legacy) : dates fixes de SUMMER_PERIODS (end inclusif).
 *
 * Lève si année ≥ FIRST_PIVOT_YEAR sans date votée : on refuse d'inventer une
 * date. Les appelants qui balaient des années arbitraires DOIVENT filtrer via
 * isSummerYearConfigured() au préalable.
 */
export function getPeriodDates(
  year: number,
  period: SummerPeriod
): { start: string; end: string } {
  const votedStart = SUMMER_PERIOD_1_START[year];

  if (votedStart) {
    const startOffset = (period.id - 1) * PERIOD_DURATION_DAYS;
    return {
      start: addDays(votedStart, startOffset),
      end: addDays(votedStart, startOffset + PERIOD_DURATION_DAYS),
    };
  }

  if (year >= FIRST_PIVOT_YEAR) {
    throw new Error(
      `Été ${year} : date de début de Période 1 absente de SUMMER_PERIOD_1_START (lib/config.ts).`
    );
  }

  // Legacy ≤2026 : dates fixes
  const start = `${year}-${String(period.startMonth).padStart(2, "0")}-${String(
    period.startDay
  ).padStart(2, "0")}`;
  const end = `${year}-${String(period.endMonth).padStart(2, "0")}-${String(
    period.endDay
  ).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Libellé lisible d'une période, calculé depuis ses VRAIES dates.
 * À utiliser à la place du champ statique `description` (faux pour ≥2027).
 * Ex : "28 juin → 19 juillet".
 */
export function getPeriodRangeLabel(
  year: number,
  period: SummerPeriod
): string {
  const { start, end } = getPeriodDates(year, period);
  const fmt = (iso: string) =>
    parseLocalDate(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    });
  return `${fmt(start)} → ${fmt(end)}`;
}

/**
 * Détermine quelle "année d'été" est pertinente pour l'utilisateur.
 * Bascule au 1er octobre : avant on parle de l'été courant ; à partir du 1er oct
 * on prépare l'été suivant (les choix se font dès janvier).
 */
export function getRelevantSummerYear(today: Date = new Date()): number {
  const currentYear = today.getFullYear();
  const switchover = new Date(currentYear, 9, 1); // 1er octobre (mois 9 en JS)
  switchover.setHours(0, 0, 0, 0);
  return today >= switchover ? currentYear + 1 : currentYear;
}

/**
 * Vérifie si une plage de dates chevauche une des 3 périodes d'été.
 * Renvoie null si l'année n'est pas configurée (aucune période → aucun
 * chevauchement, plutôt que de lever).
 */
export function overlapsSummerPeriod(
  startISO: string,
  endISO: string
): SummerPeriod | null {
  const year = parseInt(startISO.slice(0, 4));
  if (!isSummerYearConfigured(year)) return null;

  for (const period of SUMMER_PERIODS) {
    const dates = getPeriodDates(year, period);
    if (startISO <= dates.end && endISO >= dates.start) {
      return period;
    }
  }
  return null;
}