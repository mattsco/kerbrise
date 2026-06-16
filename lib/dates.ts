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
 * Date du jour en ISO YYYY-MM-DD, forcée en fuseau Europe/Paris.
 * Indispensable côté serveur (Vercel tourne en UTC) : entre ~22h-minuit UTC,
 * la date UTC est en retard d'un jour sur Paris. À utiliser dans les routes API.
 */
export function todayInParis(): string {
  // en-CA → format YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
 * Nombre de jours (inclusifs) d'un séjour qui tombent dans une fenêtre.
 * Sert à clipper un séjour à cheval sur deux années à l'année affichée.
 * Ex: séjour 28 déc → 3 janv, fenêtre 2026 = 3 jours côté 2026.
 * Source unique : page Stats + stats d'occupation du calendrier desktop (#31).
 */
export function daysInRangeClipped(
  startISO: string,
  endISO: string,
  rangeStartISO: string,
  rangeEndISO: string
): number {
  const overlapStart = startISO > rangeStartISO ? startISO : rangeStartISO;
  const overlapEnd = endISO < rangeEndISO ? endISO : rangeEndISO;

  if (overlapStart > overlapEnd) return 0;

  return daysInRangeInclusive(overlapStart, overlapEnd);
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

/**
 * Ajoute (ou retire) un nombre de jours à une date ISO, en heure locale.
 * DST-safe via parseLocalDate / dateToISO.
 */
export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return dateToISO(d);
}