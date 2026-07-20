// lib/summer-adjacent-state.ts
//
// Snapshot DB des détenteurs de P1 / P3 (#39) — pendant de lib/ponts-state.ts.
//
// ⚠️ Pourquoi ne pas réutiliser getSummerSnapshot (lib/summer-state.ts) : il
// importe le client Supabase SERVEUR (@/lib/supabase/server) et n'est donc pas
// appelable depuis les Client Components où vivent les warnings. On repasse par
// getSummerBookings, qui prend le client en argument, + le calcul pur
// buildPeriodHolders. Même requête, même matching de dates canoniques.

import { getSummerBookings } from "./data/bookings";
import {
  buildPeriodHolders,
  type PeriodBooking,
  type SummerAdjacentState,
} from "./summer-adjacent";

type SupabaseLike = { from: (table: string) => unknown };

/** Détenteurs de P1 et P3 pour l'année (seul `approved` compte). */
export async function getSummerAdjacentSnapshot(
  supabase: SupabaseLike,
  year: number
): Promise<SummerAdjacentState> {
  const bookings = await getSummerBookings(
    supabase as Parameters<typeof getSummerBookings>[0],
    year
  );

  const periodBookings: PeriodBooking[] = bookings.map((b) => ({
    family_name: b.family_name,
    start_date: b.start_date,
    end_date: b.end_date,
    status: b.status,
  }));

  return { year, holders: buildPeriodHolders(year, periodBookings) };
}
