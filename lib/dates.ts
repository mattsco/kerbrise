/**
 * Renvoie true si le séjour est actif, à venir, ou terminé depuis moins de N jours.
 * Par défaut : 2 jours après end_date (pour permettre extension de séjour en cours
 * ou correction tardive).
 */
export function isStayActiveOrFuture(endDate: string, daysAfterEnd: number = 2): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - daysAfterEnd);
  const [y, m, d] = endDate.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  return end >= cutoff;
}