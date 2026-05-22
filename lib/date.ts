/**
 * Renvoie true si le séjour est toujours actif, à venir, ou terminé depuis moins de N jours.
 * Par défaut : on considère un séjour modifiable jusqu'à 2 jours après sa fin
 * (au cas où l'auteur veut prolonger un séjour en cours).
 */
export function isStayActiveOrFuture(endDate: string, daysAfterEnd: number = 2): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - daysAfterEnd);
  // Parse en local pour éviter les soucis de fuseau (les dates sont en YYYY-MM-DD)
  const [y, m, d] = endDate.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  return end >= cutoff;
}