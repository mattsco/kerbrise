/**
 * Système de priorités pour les périodes d'été (juillet/août) à Kerbrise.
 * Rotation modulo 3 démarrant en 2024.
 *
 *   2024 : Antoine (1), Vincent (2), François (3)
 *   2025 : Vincent (1), François (2), Antoine (3)
 *   2026 : François (1), Antoine (2), Vincent (3)
 *   2027 : Antoine (1), ... (cycle)
 */

import { FAMILIES, type FamilyName } from "./families";

export type { FamilyName }; // re-export pour rétro-compat

export const SUMMER_PERIODS = [
  {
    id: 1,
    startMonth: 6,
    startDay: 29,
    endMonth: 7,
    endDay: 19,
    label: "Période 1",
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
    1: FAMILY_ROTATION[offset],
    2: FAMILY_ROTATION[(offset + 1) % 3],
    3: FAMILY_ROTATION[(offset + 2) % 3],
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
 */
export function getPeriodDates(
  year: number,
  period: SummerPeriod
): { start: string; end: string } {
  const start = `${year}-${String(period.startMonth).padStart(2, "0")}-${String(
    period.startDay
  ).padStart(2, "0")}`;
  const end = `${year}-${String(period.endMonth).padStart(2, "0")}-${String(
    period.endDay
  ).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Détermine quelle "année d'été" est pertinente pour le user.
 * Si on est avant le 31 août, on parle de l'été de l'année courante.
 * Sinon, on parle de l'été de l'année suivante.
 */
export function getRelevantSummerYear(today: Date = new Date()): number {
  const currentYear = today.getFullYear();
  const endOfSummer = new Date(currentYear, 7, 31); // 31 août = mois 7 en JS
  endOfSummer.setHours(23, 59, 59, 999);

  return today > endOfSummer ? currentYear + 1 : currentYear;
}

/**
 * Vérifie si une plage de dates chevauche une des 3 périodes d'été.
 */
export function overlapsSummerPeriod(
  startISO: string,
  endISO: string
): SummerPeriod | null {
  const year = parseInt(startISO.slice(0, 4));
  for (const period of SUMMER_PERIODS) {
    const dates = getPeriodDates(year, period);
    if (startISO <= dates.end && endISO >= dates.start) {
      return period;
    }
  }
  return null;
}