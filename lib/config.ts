/**
 * Configuration globale de Kerbrise.
 *
 * À terme, ces valeurs seront éditables via une page admin (#25 backlog).
 * Pour l'instant, on les modifie ici, commit, push, et c'est en ligne en ~1min.
 */

import packageJson from "@/package.json";

export const APP_VERSION = packageJson.version;

/**
 * Si true, n'importe quel membre de la famille peut réserver une période d'été.
 * Si false (défaut), seul le chef de famille (is_family_head) peut.
 */
export const SUMMER_CHOICE_FREEDOM = false;