/**
 * Logique du rappel « bac bleu » (#40).
 *
 * Pure, zéro I/O, testée — esprit #34. La route API se contente d'enchaîner
 * ces trois questions puis d'envoyer l'e-mail.
 *
 * Les trois gardes, dans l'ordre où la route les pose :
 *   1. Est-on à l'heure d'envoi ?          → parisHour()
 *   2. Y a-t-il collecte demain matin ?    → recyclablesCollectionTomorrow()
 *   3. Qui dort à Kerbrise ce soir ?       → occupantOn()
 *
 * Les cas 2 et 3 renvoient `null` la plupart du temps — une semaine sur deux
 * pour le premier, la majorité de l'année pour le second. Ce n'est jamais une
 * erreur, c'est le fonctionnement normal.
 */

import { getNextCollections, type Collection } from "./garbage-collection";
import { parseLocalDate, addDays, dateToISO } from "./dates";

/**
 * Heure locale à Paris (0-23) pour un instant donné.
 *
 * Vercel et pg_cron tournent en UTC. Sans cette conversion, un envoi « à 18h »
 * dériverait d'une heure entre l'été et l'hiver — le digest hebdomadaire vit
 * déjà avec ce décalage, on ne le reproduit pas ici (décision D5 de la spec,
 * révisée : Antoine a demandé 18h, pas « 17h ou 18h selon la saison »).
 */
export function parisHour(now: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number(h);
}

/** Heure d'envoi du rappel, en heure de Paris. */
export const SEND_HOUR_PARIS = 18;

/**
 * La collecte recyclables dont `dateISO` est la veille, ou null.
 *
 * ⚠️ Ne réimplémente PAS le calendrier : délègue à `getNextCollections`, la
 * même source que la page À propos et l'écran TRMNL. Conséquence assumée —
 * après le 31/01/2027 cette fonction renvoie `null` pour toujours et le rappel
 * s'éteint en silence. C'est pour ça que la couverture du calendrier doit
 * rejoindre le check santé #33 (cf. docs/specs/rappel-poubelle-recyclables.md §7).
 */
export function recyclablesCollectionTomorrow(
  dateISO: string
): Collection | null {
  const tomorrowISO = addDays(dateISO, 1);
  const { recyclables } = getNextCollections(parseLocalDate(tomorrowISO));

  // getNextCollections renvoie la PROCHAINE collecte à partir de la date
  // donnée, inclusive. Si c'est bien demain, c'est notre jour.
  if (!recyclables) return null;
  return dateToISO(recyclables.date) === tomorrowISO ? recyclables : null;
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
