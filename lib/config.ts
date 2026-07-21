/**
 * Configuration globale de Kerbrise.
 *
 * Source unique pour :
 *   - la version affichée de l'app
 *   - les flags de comportement (été, etc.)
 *
 * À terme, les flags seront éditables via une page admin (#25 backlog,
 * cf docs/specs/config-page-admin.md). Pour l'instant on les modifie ici,
 * commit, push, et c'est en ligne en ~1min.
 */

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/**
 * Version affichée de l'app.
 *
 * ⚠️ Source de vérité = package.json ("version"). On la ré-importe ici pour
 * éviter de saisir le numéro à deux endroits et qu'ils divergent.
 */
import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;

/** "v1.2.0" — pratique pour l'affichage direct. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

// ---------------------------------------------------------------------------
// Dates clés
// ---------------------------------------------------------------------------

/**
 * Date de mise en ligne de Kerbrise (YYYY-MM-DD).
 *
 * Sert de césure entre les séjours historiques importés par l'admin
 * (is_admin_created) et les vraies demandes des membres : les compteurs de
 * séjours filtrent sur `created_at > LAUNCH_DATE`.
 */
export const LAUNCH_DATE = "2026-05-22";

// ---------------------------------------------------------------------------
// Flags de comportement
// ---------------------------------------------------------------------------

/**
 * Si true, n'importe quel membre de la famille peut réserver une période d'été.
 * Si false (défaut), seul le chef de famille (is_family_head) peut.
 */
export const SUMMER_CHOICE_FREEDOM = false;


/**
 * Date de début de la Période 1 d'été, votée chaque année par la famille.
 * P2 et P3 en découlent : chaque période = 3 semaines (21j), le dernier jour
 * d'une période est le jour pivot = premier jour de la suivante. Le pivot tombe
 * donc toujours le même jour de semaine que le début de P1.
 *
 * ⚠️ Modèle "pivot" = 2027+ uniquement. Les années ≤ 2026 gardent l'ancien
 * modèle à dates fixes (SUMMER_PERIODS) pour ne pas casser les résas existantes.
 */
export const SUMMER_PERIOD_1_START: Record<number, string> = {
  2027: "2027-06-28", // lundi
  2028: "2028-07-01", // samedi
  2029: "2029-06-30", // samedi
};




// ---------------------------------------------------------------------------
// Maison
// ---------------------------------------------------------------------------

/**
 * Mot de passe du wifi de Kerbrise.
 *
 * Déplacé ici depuis `app/dashboard/a-propos/MaisonStatus.tsx` pour #37 : la
 * page hors ligne l'affiche aussi, et une constante dupliquée dans deux
 * composants finit toujours par diverger lors d'un changement de box.
 *
 * ⚠️ En clair dans le bundle client, donc dans le cache du navigateur — choix
 * de sécurité explicite et documenté (spec #37, décision 1) : appareils
 * familiaux, et le mot de passe est de toute façon écrit sur la box.
 */
export const WIFI_PASSWORD = "kerbrise";
