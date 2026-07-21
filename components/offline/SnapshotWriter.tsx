"use client";

import { useEffect } from "react";
import { runWhenIdle } from "@/lib/idle";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_STATUSES, UNKNOWN_FAMILY_COLOR, UNKNOWN_FAMILY_NAME } from "@/lib/data/types";
import type { CalendarBooking } from "@/lib/data/types";
import {
  SNAPSHOT_KEY,
  SNAPSHOT_VERSION,
  snapshotWindow,
  type OfflineSnapshot,
} from "@/lib/offline-snapshot";

/**
 * Écrit le snapshot calendrier à chaque ouverture EN LIGNE du dashboard
 * (spec #37, étape 3). Monté dans le layout dashboard, donc post-login.
 *
 * Pourquoi une requête client plutôt que des données passées par le serveur :
 * le dashboard ne charge pas le calendrier, et l'y ajouter alourdirait chaque
 * rendu de la home pour une donnée qui ne sert qu'hors ligne. Ici, la requête
 * part en arrière-plan après le rendu et ne bloque rien.
 *
 * ⚠️ En dev local avec DEV_LOGIN_BYPASS, cette requête revient VIDE : le
 * navigateur n'a pas de session Supabase (cf. docs/guides/pieges-connus.md
 * n°3). Le snapshot ne s'écrit donc pas en local — c'est attendu, pas un bug.
 */
/**
 * Forme brute renvoyée par la jointure Supabase. Déclarée ici plutôt que
 * castée en `any` : c'est le seul endroit où l'on relit ces colonnes hors du
 * data layer.
 */
type BookingRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved";
  family_id: string;
  families: { name: string; color: string } | null;
};

export default function SnapshotWriter() {
  useEffect(() => {
    let cancelled = false;

    async function write() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { from, to } = snapshotWindow(new Date());

        // Une seule requête, filtrée sur la fenêtre : quelques Ko.
        // `end_date >= from` et `start_date <= to` — un séjour à cheval sur
        // une borne doit être visible, sinon il disparaîtrait du calendrier
        // hors ligne alors qu'il est en cours.
        const [bookingsRes, profileRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("id, start_date, end_date, status, family_id, families(name, color)")
            .in("status", ACTIVE_STATUSES as unknown as string[])
            .gte("end_date", from)
            .lte("start_date", to)
            .order("start_date"),
          supabase
            .from("users")
            .select("families(name)")
            .eq("id", user.id)
            .single(),
        ]);

        if (cancelled || bookingsRes.error || !bookingsRes.data) return;

        const bookings: CalendarBooking[] = (
          bookingsRes.data as unknown as BookingRow[]
        ).map((b) => ({
          id: b.id,
          bookingId: b.id,
          start_date: b.start_date,
          end_date: b.end_date,
          family_id: b.family_id,
          family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
          color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
          status: b.status,
        }));

        // Requête vide = probablement le bypass de dev (piège n°3), ou une
        // session expirée. Écraser un snapshot valide par du vide ferait
        // croire hors ligne que le calendrier est libre : on s'abstient.
        if (bookings.length === 0) return;

        const snapshot: OfflineSnapshot = {
          version: SNAPSHOT_VERSION,
          savedAt: new Date().toISOString(),
          from,
          to,
          bookings,
          familyName:
            (profileRes.data as { families?: { name: string } | null } | null)
              ?.families?.name ?? null,
        };

        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // Hors ligne, quota dépassé, session expirée : on garde le snapshot
        // précédent. Ne jamais déranger l'utilisateur pour ça.
      }
    }

    // Après le `load` et une fois le navigateur inactif : deux requêtes
    // Supabase de plus ne doivent jamais retarder l'affichage du dashboard.
    const cancel = runWhenIdle(write);
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  return null;
}
