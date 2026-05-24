export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Renvoie l'indice 0-6 où 0 = lundi, 6 = dimanche
export function dayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

// True si samedi (5) ou dimanche (6)
export function isWeekendIndex(i: number) {
  return i === 5 || i === 6;
}