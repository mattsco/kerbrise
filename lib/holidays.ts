import Holidays from "date-holidays";

// Initialise une fois pour la France
const hd = new Holidays("FR");

export type Holiday = {
  date: string; // ISO YYYY-MM-DD
  name: string;
  shortName: string;
};

/**
 * Récupère les jours fériés pour une année donnée.
 */
export function getHolidaysForYear(year: number): Holiday[] {
  const holidays = hd.getHolidays(year);
  return holidays
    .filter((h: any) => h.type === "public") // seulement les jours fériés officiels
    .map((h: any) => ({
      date: h.date.split(" ")[0], // "2026-07-14 00:00:00" → "2026-07-14"
      name: h.name,
      shortName: shortenName(h.name),
    }));
}

/**
 * Récupère les jours fériés d'une plage de dates (utile pour calendrier sur 3 mois).
 */
export function getHolidaysInRange(startISO: string, endISO: string): Holiday[] {
  const startYear = parseInt(startISO.split("-")[0]);
  const endYear = parseInt(endISO.split("-")[0]);

  const allHolidays: Holiday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    allHolidays.push(...getHolidaysForYear(y));
  }

  return allHolidays.filter((h) => h.date >= startISO && h.date <= endISO);
}

/**
 * Vérifie si une date ISO est un jour férié français.
 */
export function getHolidayForDate(iso: string): Holiday | null {
  const year = parseInt(iso.split("-")[0]);
  return getHolidaysForYear(year).find((h) => h.date === iso) ?? null;
}

/**
 * Raccourcit les noms longs pour affichage compact.
 */
function shortenName(name: string): string {
  // ⚠️ Clés = noms EXACTS renvoyés par date-holidays pour "FR" (vérifiés par
  // lib/holidays.test.ts — avant ça, 5 clés sur 11 ne matchaient jamais).
  const map: Record<string, string> = {
    "Nouvel An": "Jour de l'an",
    "Lundi de Pâques": "Pâques",
    "Fête du travail": "1er Mai",
    "Fête de la Victoire 1945": "8 Mai",
    "Ascension": "Ascension",
    "Lundi de Pentecôte": "Pentecôte",
    "Fête Nationale de la France": "14 Juillet",
    "Assomption": "Assomption",
    "Toussaint": "Toussaint",
    "Armistice 1918": "11 Novembre",
    "Noël": "Noël",
  };
  return map[name] ?? name;
}