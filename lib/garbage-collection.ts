/**
 * Collectes des déchets à Kerbrise (Saint-Malo Agglo - Secteur C)
 *
 * Règles :
 * - Ordures ménagères : tous les lundis
 * - Recyclables : mercredis 1 sur 2, à partir du 3 juin 2026
 */

const RECYCLABLES_START = new Date("2026-06-03"); // Mercredi
const RECYCLABLES_END = new Date("2027-01-31");

export type Collection = {
  date: string; // ISO YYYY-MM-DD
  type: "menageres" | "recyclables";
  label: string;
  emoji: string;
};

/**
 * Retourne la prochaine collecte d'ordures ménagères (prochain lundi >= today)
 */
function getNextMenageres(from: Date): Collection {
  const date = new Date(from);
  // Trouve le prochain lundi (1)
  const dayOfWeek = date.getDay(); // 0 = dimanche, 1 = lundi
  const daysToAdd = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  date.setDate(date.getDate() + daysToAdd);
  return {
    date: date.toISOString().slice(0, 10),
    type: "menageres",
    label: "Ordures ménagères",
    emoji: "🟤",
  };
}

/**
 * Retourne la prochaine collecte de recyclables (mercredi 1 sur 2 à partir du 3 juin 2026)
 */
function getNextRecyclables(from: Date): Collection | null {
  if (from > RECYCLABLES_END) return null;

  let candidate = from < RECYCLABLES_START ? new Date(RECYCLABLES_START) : new Date(from);

  // Trouve le prochain mercredi (3)
  const dayOfWeek = candidate.getDay();
  const daysToAdd =
    dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
  candidate.setDate(candidate.getDate() + daysToAdd);

  // Vérifie que c'est bien un mercredi pair depuis RECYCLABLES_START
  const diffDays = Math.round(
    (candidate.getTime() - RECYCLABLES_START.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weeksFromStart = Math.floor(diffDays / 7);

  // Si la semaine n'est pas alignée (impaire), ajouter 7 jours
  if (weeksFromStart % 2 !== 0) {
    candidate.setDate(candidate.getDate() + 7);
  }

  // Vérifier qu'on est encore dans la période
  if (candidate > RECYCLABLES_END) return null;

  return {
    date: candidate.toISOString().slice(0, 10),
    type: "recyclables",
    label: "Recyclables",
    emoji: "🟡",
  };
}

/**
 * Retourne les 2 prochaines collectes (1 ordures, 1 recyclables)
 */
export function getNextCollections(from: Date = new Date()): {
  menageres: Collection;
  recyclables: Collection | null;
} {
  // Démarre à demain pour éviter "aujourd'hui" si la collecte est passée
  const tomorrow = new Date(from);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    menageres: getNextMenageres(tomorrow),
    recyclables: getNextRecyclables(tomorrow),
  };
}

/**
 * Formate la date relative en français
 */
export function formatRelativeDate(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "demain";
  if (diffDays < 7) return `dans ${diffDays} jours`;
  if (diffDays < 14) return `dans ${diffDays} jours`;
  return `dans ${Math.floor(diffDays / 7)} semaines`;
}

/**
 * Formate "Lundi 26 mai"
 */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}