/**
 * Collectes des déchets à Kerbrise (Saint-Malo Agglo - Secteur C)
 *
 * Règles :
 * - Ordures ménagères : tous les lundis
 * - Recyclables : mercredis 1 sur 2, à partir du 3 juin 2026
 */

// Mercredi 3 juin 2026 (date de référence pour le démarrage recyclables)
const RECYCLABLES_START_YEAR = 2026;
const RECYCLABLES_START_MONTH = 5; // juin (0-indexed)
const RECYCLABLES_START_DAY = 3;

// Fin du calendrier connu
const RECYCLABLES_END_YEAR = 2027;
const RECYCLABLES_END_MONTH = 0; // janvier
const RECYCLABLES_END_DAY = 31;

export type Collection = {
  date: Date;
  type: "menageres" | "recyclables";
  label: string;
  emoji: string;
};

/**
 * Retourne la date du prochain lundi à partir de "from" (inclus si lundi).
 */
function getNextMenageres(from: Date): Collection {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = date.getDay(); // 0 = dim, 1 = lun, ..., 6 = sam
  const daysToAdd = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  date.setDate(date.getDate() + daysToAdd);
  return {
    date,
    type: "menageres",
    label: "Ordures ménagères",
    emoji: "🟢",
  };
}

/**
 * Retourne la date du prochain mercredi pair (1 sur 2) depuis le 3 juin 2026.
 */
function getNextRecyclables(from: Date): Collection | null {
  const start = new Date(
    RECYCLABLES_START_YEAR,
    RECYCLABLES_START_MONTH,
    RECYCLABLES_START_DAY
  );
  start.setHours(0, 0, 0, 0);

  const end = new Date(
    RECYCLABLES_END_YEAR,
    RECYCLABLES_END_MONTH,
    RECYCLABLES_END_DAY
  );
  end.setHours(23, 59, 59, 999);

  if (from > end) return null;

  let candidate = from < start ? new Date(start) : new Date(from);
  candidate.setHours(0, 0, 0, 0);

  // Avancer jusqu'au prochain mercredi (3 = mercredi)
  const dayOfWeek = candidate.getDay();
  const daysToAdd =
    dayOfWeek === 3 ? 0 : dayOfWeek < 3 ? 3 - dayOfWeek : 10 - dayOfWeek;
  candidate.setDate(candidate.getDate() + daysToAdd);

  // Vérifier qu'on est sur un mercredi pair depuis le 3 juin
  const diffDays = Math.round(
    (candidate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weeksFromStart = Math.floor(diffDays / 7);

  // Si semaine impaire depuis start, on saute au mercredi suivant
  if (weeksFromStart % 2 !== 0) {
    candidate.setDate(candidate.getDate() + 7);
  }

  if (candidate > end) return null;

  return {
    date: candidate,
    type: "recyclables",
    label: "Recyclables",
    emoji: "🟡",
  };
}

/**
 * Retourne les prochaines collectes (1 ordures, 1 recyclables) à partir d'aujourd'hui.
 */
export function getNextCollections(from: Date = new Date()): {
  menageres: Collection;
  recyclables: Collection | null;
} {
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  return {
    menageres: getNextMenageres(today),
    recyclables: getNextRecyclables(today),
  };
}

/**
 * Formate la date relative en français
 */
export function formatRelativeDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "demain";
  if (diffDays < 14) return `dans ${diffDays} jours`;
  return `dans ${Math.floor(diffDays / 7)} semaines`;
}

/**
 * Formate court : "Lun 25 mai"
 */
export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}