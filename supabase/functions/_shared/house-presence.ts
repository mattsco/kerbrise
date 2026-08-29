/**
 * Qui est à Kerbrise, et quand envoyer — logique du rappel #40.
 *
 * ⚠️ CE FICHIER DOIT RESTER SANS IMPORT, pour la même raison que
 * `garbage-collection.ts` : il est lu par l'Edge Function (Deno, extension
 * `.ts` obligatoire) ET par les tests vitest côté Next (extension interdite).
 * Un fichier sans import est le seul à passer les deux.
 *
 * Pur, zéro I/O. L'Edge Function se contente d'enchaîner ces questions.
 */

/** Heure d'envoi du rappel, en heure de Paris. */
export const SEND_HOUR_PARIS = 18;

/**
 * Heure locale à Paris (0-23) pour un instant donné.
 *
 * pg_cron parle UTC : 18h à Paris vaut 16h UTC l'été et 17h l'hiver. Le job
 * se déclenche donc aux DEUX heures, et ce garde ne laisse passer que celle
 * qui vaut réellement 18h — changement d'heure compris, sans table de fuseaux.
 */
export function parisHour(now: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number(h);
}

export type StayRow = {
  start_date: string;
  end_date: string;
  family_id: string;
};

/**
 * Le séjour dont l'occupant dort à Kerbrise la nuit du `dateISO`, ou null.
 *
 * Borne haute STRICTE : dans cette app `nuits = end_date - start_date`, donc
 * `end_date` est le jour du DÉPART, pas la dernière nuit passée sur place.
 *
 *   séjour 1ᵉʳ → 8 sept, on demande le 8  → non (parti le matin)
 *   séjour 1ᵉʳ → 9 sept, on demande le 8  → oui (dort là, sort le bac en partant)
 *   séjour 8 → 15 sept,  on demande le 8  → oui (arrive dans la journée)
 *
 * Le jour de relais se résout donc tout seul : c'est la famille ARRIVANTE qui
 * est retenue, et c'est bien elle qui sera là le soir.
 */
export function occupantOn(stays: StayRow[], dateISO: string): StayRow | null {
  return (
    stays.find((s) => s.start_date <= dateISO && s.end_date > dateISO) ?? null
  );
}
