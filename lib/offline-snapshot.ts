/**
 * Snapshot applicatif du calendrier pour le mode hors ligne (#37, étape 3).
 *
 * Rappel de la décision 3 : le snapshot est **applicatif**, jamais un cache
 * HTTP de réponses Supabase dans le service worker. On maîtrise donc ce qui
 * est stocké, sa fenêtre, sa fraîcheur — et sa purge à la déconnexion.
 *
 * Ce module est PUR : ni `localStorage`, ni `supabase`, ni `Date.now()` caché.
 * Tout ce qui décide (fenêtre, péremption) est testable sans navigateur.
 */

import type { CalendarBooking } from "./data/types";

/**
 * Clés de stockage — toutes purgées à la déconnexion (ServiceWorkerRegistrar).
 *
 * Deux clés distinctes et non un objet unique : chaque snapshot est écrit par
 * la page qui possède déjà la donnée (calendrier / profil). Avec une clé
 * commune, la dernière page visitée écraserait les champs de l'autre.
 */
export const SNAPSHOT_KEY = "kerbrise-offline-snapshot";
export const PROFIL_KEY = "kerbrise-offline-profil";

/**
 * Version du format. Un snapshot d'une autre version est ignoré, pas migré —
 * il se réécrira à la prochaine visite du calendrier.
 *
 * v2 : abandon de la fenêtre glissante M−3 → M+12 au profit de la totalité
 * des séjours. Mesuré sur la vraie base : 166 séjours actifs de 2015 à 2027,
 * soit ~45 Ko de JSON. Découper une fenêtre dans si peu de données ajoutait
 * des cas limites (séjour à cheval sur une borne) sans rien économiser.
 */
export const SNAPSHOT_VERSION = 2;

/**
 * Au-delà, le bandeau passe en avertissement (décision 8).
 *
 * Le calendrier de l'année suivante est vide et se remplit sur ~6 mois : un
 * snapshot périmé est donc **systématiquement optimiste** — il montre libre ce
 * qui vient d'être pris. C'est le seul risque produit sérieux de tout #37.
 */
export const STALE_AFTER_DAYS = 7;

export type OfflineSnapshot = {
  version: number;
  /** ISO 8601 de l'écriture. */
  savedAt: string;
  /** Tous les séjours actifs, tels qu'affichés par le calendrier en ligne. */
  bookings: CalendarBooking[];
  /** Nom de la famille de l'utilisateur — le seul bout personnalisé. */
  familyName: string | null;
};

/**
 * Ce que la page profil sait d'un utilisateur, recopié depuis les données
 * qu'elle a déjà chargées côté serveur (décision 19).
 *
 * Vit dans le localStorage de l'appareil, pas dans le HTML mis en cache : ces
 * champs sont personnels, et un HTML précaché est partagé par tous ceux qui
 * ouvrent l'app sur ce téléphone. C'est cette distinction qui les rend
 * acceptables ici alors qu'ils sont exclus du rendu serveur.
 */
export type OfflineProfil = {
  version: number;
  savedAt: string;
  displayName: string;
  email: string | null;
  familyName: string | null;
  roles: string[];
  sejourCount: number | null;
};

export type SnapshotFreshness =
  | { state: "absent" }
  | { state: "fresh"; savedAt: Date; ageDays: number }
  | { state: "stale"; savedAt: Date; ageDays: number };

/**
 * Classe la fraîcheur d'un snapshot. `null` (absent, illisible, version
 * inconnue) est un cas normal, pas une erreur : iOS évince, et un appareil
 * qui n'a jamais ouvert l'app en ligne n'a rien.
 */
export function snapshotFreshness(
  snapshot: OfflineSnapshot | null,
  now: Date
): SnapshotFreshness {
  if (!snapshot) return { state: "absent" };

  const savedAt = new Date(snapshot.savedAt);
  if (Number.isNaN(savedAt.getTime())) return { state: "absent" };

  const ageDays = Math.floor(
    (now.getTime() - savedAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Une horloge en avance (fuseau, réglage manuel) ne doit pas produire un âge
  // négatif qui passerait pour frais à tort — on borne à 0.
  const age = Math.max(0, ageDays);

  return age >= STALE_AFTER_DAYS
    ? { state: "stale", savedAt, ageDays: age }
    : { state: "fresh", savedAt, ageDays: age };
}

/**
 * Parse défensivement : tout snapshot douteux devient `null` (donc « pas
 * encore de synchro »), plutôt qu'un rendu à moitié cassé.
 */
export function parseSnapshot(raw: string | null): OfflineSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.version !== SNAPSHOT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      !Array.isArray(parsed.bookings)
    ) {
      return null;
    }
    return parsed as OfflineSnapshot;
  } catch {
    return null;
  }
}

/** Même parsing défensif que le snapshot calendrier : le doute vaut absence. */
export function parseProfil(raw: string | null): OfflineProfil | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.version !== SNAPSHOT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      typeof parsed.displayName !== "string"
    ) {
      return null;
    }
    return parsed as OfflineProfil;
  } catch {
    return null;
  }
}

/** "samedi 12 juillet 2026 à 14h30" — pour le bandeau. */
export function formatSavedAt(date: Date): string {
  const d = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const t = date
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
  return `${d} à ${t}`;
}
