// lib/dates.ts

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Parse une date ISO YYYY-MM-DD comme date locale (minuit Paris).
 * Évite le piège de `new Date("2026-05-24")` qui parse en UTC.
 */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formate une Date en ISO YYYY-MM-DD selon le fuseau local.
 * Évite le piège de `d.toISOString().slice(0, 10)` qui formate en UTC.
 */
export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Date du jour en ISO YYYY-MM-DD (fuseau local).
 * À utiliser PARTOUT au lieu de new Date().toISOString().slice(0, 10).
 */
export function todayISO(): string {
  return dateToISO(new Date());
}

/**
 * Nombre de jours entre deux dates ISO (signé, b - a).
 * Robuste aux changements DST grâce à Math.round.
 */
export function daysBetween(a: string, b: string): number {
  const dA = parseLocalDate(a);
  const dB = parseLocalDate(b);
  return Math.round((dB.getTime() - dA.getTime()) / MS_PER_DAY);
}

/**
 * Nombre de jours dans une plage, bornes incluses.
 * Ex: "2026-05-01" → "2026-05-03" = 3 jours.
 */
export function daysInRangeInclusive(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

/**
 * Renvoie true si le séjour est actif, à venir, ou terminé depuis moins de N jours.
 * Par défaut : 2 jours après end_date.
 */
export function isStayActiveOrFuture(
  endDate: string,
  daysAfterEnd: number = 2
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - daysAfterEnd);
  const end = parseLocalDate(endDate);
  return end >= cutoff;
}