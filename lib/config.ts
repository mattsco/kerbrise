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

/** "v1.1.0" — pratique pour l'affichage direct. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;

// ---------------------------------------------------------------------------
// Flags de comportement
// ---------------------------------------------------------------------------

/**
 * Si true, n'importe quel membre de la famille peut réserver une période d'été.
 * Si false (défaut), seul le chef de famille (is_family_head) peut.
 */
export const SUMMER_CHOICE_FREEDOM = false;
