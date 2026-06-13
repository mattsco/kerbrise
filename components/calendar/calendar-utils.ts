export { parseLocalDate, dateToISO } from "@/lib/dates";

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// 0 = lundi, 6 = dimanche
export function dayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function isWeekendIndex(i: number) {
  return i === 5 || i === 6;
}

// Source unique des noms de mois (vue mobile MonthGrid + vue desktop #31)
export const FRENCH_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

/**
 * Mode d'affichage de la grille desktop (#31, bloc "Vue" du sidepanel).
 * "stays"  : occupation par famille (vue historique façon tableur).
 * "tides"  : heatmap des coefficients de marée (lib/tides.ts).
 * Pensé pour s'étendre (d'autres vues viendront) sans toucher au reste.
 */
export type CalendarView = "stays" | "tides";
