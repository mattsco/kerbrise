/**
 * Logique des placeholders d'été (juillet/août) sur le calendrier.
 *
 * Pour chaque année, on a 3 placeholders (Période 1, 2, 3) qui sont :
 * - "free" si aucune famille ne les a encore réservés
 * - "taken" si une famille a déjà une réservation approved sur cette période
 *
 * Une famille peut réserver un placeholder libre si toutes les familles
 * plus prioritaires qu'elle ont déjà fait leur choix.
 */

import {
  SUMMER_PERIODS,
  getPeriodDates,
  getYearPriorities,
  getFamilyPriority,
  type SummerPeriod,
} from "./summer-priorities";

export type BookingMinimal = {
  start_date: string;
  end_date: string;
  family_id: string;
  family_name: string;
  family_color: string;
  status: "pending" | "approved";
};

export type Placeholder = {
  year: number;
  period: SummerPeriod;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  status: "free" | "taken";
  takenBy?: {
    familyName: string;
    familyColor: string;
  };
};

/**
 * Pour une année donnée, calcule l'état des 3 placeholders.
 * Un placeholder est "taken" si une famille a une réservation approved
 * qui couvre EXACTEMENT la période fixe.
 */
export function computePlaceholdersForYear(
  year: number,
  bookings: BookingMinimal[]
): Placeholder[] {
  return SUMMER_PERIODS.map((period) => {
    const dates = getPeriodDates(year, period);

    const matching = bookings.find(
      (b) =>
        b.status === "approved" &&
        b.start_date === dates.start &&
        b.end_date === dates.end
    );

    if (matching) {
      return {
        year,
        period,
        startDate: dates.start,
        endDate: dates.end,
        status: "taken" as const,
        takenBy: {
          familyName: matching.family_name,
          familyColor: matching.family_color,
        },
      };
    }

    return {
      year,
      period,
      startDate: dates.start,
      endDate: dates.end,
      status: "free" as const,
    };
  });
}

/**
 * Retourne tous les placeholders à afficher (années future + année courante si pas finie).
 */
export function getAllUpcomingPlaceholders(
  bookings: BookingMinimal[],
  fromYear: number,
  toYear: number
): Placeholder[] {
  const all: Placeholder[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    all.push(...computePlaceholdersForYear(year, bookings));
  }
  return all;
}

/**
 * Pour un placeholder donné, détermine si la famille du user peut le réserver.
 *
 * Règle :
 * - Calculer la priorité de la famille pour cette année (1, 2, ou 3)
 * - Compter combien de placeholders sont déjà "taken" pour cette année
 * - Si (placeholders pris) >= (priorité_famille - 1), alors c'est son tour
 *
 * Concrètement :
 * - Priorité 1 : peut toujours réserver
 * - Priorité 2 : peut réserver si au moins 1 placeholder est déjà taken
 * - Priorité 3 : peut réserver si au moins 2 placeholders sont déjà taken
 */
export function canFamilyReservePlaceholder(
  placeholder: Placeholder,
  myFamilyName: string,
  allPlaceholdersForYear: Placeholder[]
): {
  allowed: boolean;
  myPriority: number | null;
  reason?: string;
  blockingFamily?: string;
} {
  if (placeholder.status !== "free") {
    return { allowed: false, myPriority: null, reason: "Placeholder déjà réservé" };
  }

  const myPriority = getFamilyPriority(placeholder.year, myFamilyName);
  if (!myPriority) {
    return { allowed: false, myPriority: null, reason: "Famille inconnue" };
  }

  const takenCount = allPlaceholdersForYear.filter(
    (p) => p.year === placeholder.year && p.status === "taken"
  ).length;

  const requiredPriorityChoices = myPriority - 1;

  if (takenCount >= requiredPriorityChoices) {
    return { allowed: true, myPriority };
  }

  // Bloquée par une famille plus prioritaire
  const nextToChoose = takenCount + 1;
  const priorities = getYearPriorities(placeholder.year);
  const blockingFamily = priorities[nextToChoose as 1 | 2 | 3];

  return {
    allowed: false,
    myPriority,
    blockingFamily,
    reason: `La famille ${blockingFamily} (Choix ${nextToChoose}) n'a pas encore choisi sa période pour l'été ${placeholder.year}.`,
  };
}

/**
 * Vérifie si une plage de dates chevauche un placeholder été (libre ou pris).
 * Utile pour bloquer les demandes "normales" qui chevauchent les périodes fixes.
 */
export function findOverlappingPlaceholder(
  startISO: string,
  endISO: string,
  allPlaceholders: Placeholder[]
): Placeholder | null {
  return (
    allPlaceholders.find(
      (p) => startISO <= p.endDate && endISO >= p.startDate
    ) ?? null
  );
}