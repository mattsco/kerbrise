// supabase/functions/_shared/dates.ts
//
// Source unique de formatage de dates pour les Edge Functions email.
// Corrige le bug timezone documenté dans docs/architecture/EMAIL_AUDIT.md :
// `new Date("2026-02-15").toLocaleDateString(...)` parse en UTC et peut afficher
// la veille selon le fuseau du runtime Deno (UTC sur Supabase).
//
// Principe : on parse les composants Y-M-D explicitement et on FIXE
// timeZone: 'Europe/Paris' au formatage. Le résultat ne dépend plus de
// l'heure ni du fuseau d'exécution de la fonction.
//
// ⚠️ Les FORMATS produits sont identiques à l'existant (ordre, séparateurs).
// Seule la *valeur* du jour change dans les cas où l'ancien code décalait.
// notify-decision dépend du format exact (il fait .split(' ').slice(1,3)) :
// ne pas modifier l'ordre "weekday day month year".

const TZ = "Europe/Paris";

/**
 * Parse une date ISO YYYY-MM-DD en Date au midi Paris.
 * Midi (et non minuit) garantit qu'aucun décalage DST/fuseau ne fait
 * basculer le jour affiché. Le formatage fixe ensuite le fuseau Paris.
 */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  // Midi UTC : à ±14h de décalage near, on reste le même jour calendaire à Paris.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Format long. Par défaut "vendredi 1 janvier 2027".
 * withYear=false → "vendredi 1 janvier" (utilisé par le digest hebdo).
 */
export function formatDate(iso: string, opts: { withYear?: boolean } = {}): string {
  const withYear = opts.withYear ?? true;
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/**
 * Format court "1 janv.".
 */
export function formatShort(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  });
}

/**
 * Plage de dates avec année affichée UNE seule fois (sur la date de fin).
 * - même mois & année : "1 → 12 août 2026"
 * - même année, mois ≠ : "28 juillet → 3 août 2026"
 * - années ≠           : "30 décembre 2026 → 2 janvier 2027"
 * withWeekday=true ajoute le jour de semaine (calendrier du digest).
 *
 * N.B. : volontairement séparé de formatDate() pour ne PAS casser le sujet
 * de notify-decision qui fait formatDate(...).split(' ').slice(1,3).
 */
export function formatRange(
  startIso: string,
  endIso: string,
  opts: { withWeekday?: boolean; noYear?: boolean } = {},
): string {
  const withWeekday = opts.withWeekday ?? false;
  const noYear = opts.noYear ?? false;
  const [sy, sm] = startIso.split("-").map(Number);
  const [ey, em] = endIso.split("-").map(Number);
  const base: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Paris",
    day: "numeric",
    ...(withWeekday ? { weekday: "long" } : {}),
  };
  // noYear masque l'année SAUF si les deux dates sont sur des années
  // différentes (sinon "30 déc. → 2 janv." serait ambigu).
  const sameYear = sy === ey;
  const showYear = !noYear || !sameYear;
  const endStr = parseLocalDate(endIso).toLocaleDateString("fr-FR", {
    ...base,
    month: "long",
    ...(showYear ? { year: "numeric" } : {}),
  });
  let startStr: string;
  if (sy === ey && sm === em) {
    startStr = parseLocalDate(startIso).toLocaleDateString("fr-FR", base);
  } else if (sameYear) {
    startStr = parseLocalDate(startIso).toLocaleDateString("fr-FR", { ...base, month: "long" });
  } else {
    startStr = parseLocalDate(startIso).toLocaleDateString("fr-FR", { ...base, month: "long", year: "numeric" });
  }
  return `${startStr} → ${endStr}`;
}

/**
 * Date du jour à Paris au format ISO YYYY-MM-DD.
 * Utilisé pour filtrer les séjours "à venir" (>= aujourd'hui Paris),
 * indépendamment du fuseau du runtime Edge (UTC).
 */
export function todayInParis(): string {
  // en-CA donne le format YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}
