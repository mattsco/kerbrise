"use client";

import { useEffect } from "react";
import { runWhenIdle } from "@/lib/idle";
import type { CalendarBooking } from "@/lib/data/types";
import {
  SNAPSHOT_KEY,
  SNAPSHOT_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline-snapshot";

/**
 * Persiste le calendrier pour le mode hors ligne (spec #37, décision 18).
 *
 * Ne fait **aucune requête** : il reçoit les séjours que la page calendrier a
 * déjà chargés côté serveur et les recopie en local. Le coût est donc nul —
 * ni requête Supabase, ni octet de réseau supplémentaire.
 *
 * Monté sur `/dashboard/calendrier` et nulle part ailleurs : c'est le seul
 * endroit de l'app où cette donnée existe déjà. Conséquence assumée — qui
 * n'ouvre jamais le calendrier n'a pas de calendrier hors ligne, et les
 * surfaces concernées le disent explicitement.
 *
 * L'écriture attend `load` puis un temps mort du navigateur : sérialiser
 * ~45 Ko ne doit pas retarder l'affichage de la grille.
 */
export default function SnapshotWriter({
  bookings,
  familyName,
}: {
  bookings: CalendarBooking[];
  familyName: string | null;
}) {
  useEffect(() => {
    // Une page calendrier vide viendrait d'une requête en échec plutôt que
    // d'une vraie absence de séjours : écraser un snapshot valide ferait
    // croire hors ligne que la maison est libre toute l'année.
    if (bookings.length === 0) return;

    return runWhenIdle(() => {
      const snapshot: OfflineSnapshot = {
        version: SNAPSHOT_VERSION,
        savedAt: new Date().toISOString(),
        bookings,
        familyName,
      };

      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // Quota dépassé, Safari en navigation privée : on garde le snapshot
        // précédent et on ne dérange pas l'utilisateur.
      }
    });
  }, [bookings, familyName]);

  return null;
}
