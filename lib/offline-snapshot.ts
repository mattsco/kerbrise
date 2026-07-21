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

/** Clé unique — partagée avec la purge au logout (ServiceWorkerRegistrar). */
export const SNAPSHOT_KEY = "kerbrise-offline-snapshot";

/** Version du format. Un snapshot d'une autre version est ignoré, pas migré. */
export const SNAPSHOT_VERSION = 1;

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
  /** Fenêtre couverte, pour ne pas laisser croire qu'on a tout. */
  from: string;
  to: string;
  bookings: CalendarBooking[];
  /** Nom de la famille de l'utilisateur — le seul bout personnalisé. */
  familyName: string | null;
};

export type SnapshotFreshness =
  | { state: "absent" }
  | { state: "fresh"; savedAt: Date; ageDays: number }
  | { state: "stale"; savedAt: Date; ageDays: number };

/**
 * Fenêtre glissante M−3 → M+12 (décision 4) : 3 mois en arrière pour le
 * contexte récent, 12 mois en avant pour couvrir la saison de planification.
 */
export function snapshotWindow(today: Date): { from: string; to: string } {
  const from = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  // Jour 0 du mois suivant = dernier jour du mois visé.
  const to = new Date(today.getFullYear(), today.getMonth() + 13, 0);
  return { from: toISO(from), to: toISO(to) };
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

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
