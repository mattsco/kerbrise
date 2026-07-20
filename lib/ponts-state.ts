// lib/ponts-state.ts
//
// Snapshot DB des ponts de mai (#38) — le pendant de lib/summer-state.ts, en
// plus simple : pas de tour-par-tour strict, pas d'auto-assignment. Une requête
// (getMayBridgeBookings) + calcul pur (buildPontsState de lib/ponts.ts).
//
// Le client Supabase est passé en argument (comme lib/data/bookings.ts) pour
// rester utilisable côté client ET serveur — les warnings sont rendus dans des
// Client Components (NewBookingForm, BookingDetailModal).

import { getMayBridgeBookings } from "./data/bookings";
import { buildPontsState, type PontState, type PontBooking } from "./ponts";

type SupabaseLike = { from: (table: string) => unknown };

/**
 * État des ponts de mai de l'année : pour chaque pont, quelles familles le
 * prennent (approved ou pending). Séjours d'un jour / hors nuits filtrés par
 * buildPontsState.
 */
export async function getMayPontsSnapshot(
  supabase: SupabaseLike,
  year: number
): Promise<PontState[]> {
  const bookings = await getMayBridgeBookings(
    supabase as Parameters<typeof getMayBridgeBookings>[0],
    year
  );

  const pontBookings: PontBooking[] = bookings.map((b) => ({
    family_id: b.family_id,
    family_name: b.family_name,
    start_date: b.start_date,
    end_date: b.end_date,
    // getMayBridgeBookings ne renvoie que pending+approved (ACTIVE_STATUSES).
    status: b.status as "pending" | "approved",
  }));

  return buildPontsState(year, pontBookings);
}
