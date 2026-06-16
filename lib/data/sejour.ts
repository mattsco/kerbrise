import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  daysBetween,
  daysInRangeInclusive,
} from "@/lib/dates";
import {
  formatEndDate,
  formatRange,
  getRelayPhrase,
} from "@/lib/dashboard-banner";

/**
 * Snapshot « séjour » niveau maison pour le TRMNL (et plus tard la page #26).
 *
 * Données SENSIBLES (présence / absence de la famille) → consommé uniquement par
 * un endpoint authentifié. Lecture via service role (la RLS bloque l'anon, voulu).
 * Non-throwing : toute erreur DB renvoie un snapshot « libre » + log, l'écran
 * TRMNL ne casse jamais à cause de la DB.
 */

export type SejourStay = {
  family: string;
  dates_label: string; // "16 → 28 juin"
  departure_label: string; // "jusqu'au 28 juin"
  days_remaining: number;
  days_remaining_label: string; // "12 jours restants"
  progress_label: string; // "Jour 1/13"
};

export type SejourNext = {
  family: string;
  arrival_label: string; // "29 juin"
  countdown_label: string; // "dans 13 jours"
  relay_label: string; // "Vincent arrive le lendemain de ton départ"
  is_pivot: boolean;
};

export type SejourSnapshot = {
  status: "occupied" | "free";
  stay: SejourStay | null;
  next: SejourNext | null;
};

type Row = { start_date: string; end_date: string; family: string };

function familyName(families: unknown): string {
  if (Array.isArray(families)) {
    const f = families[0] as { name?: string } | undefined;
    return f?.name ?? "?";
  }
  return (families as { name?: string } | null)?.name ?? "?";
}

function countdownLabel(today: string, start: string): string {
  const d = daysBetween(today, start);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d < 14) return `dans ${d} jours`;
  if (d < 60) return `dans ${Math.round(d / 7)} semaines`;
  return `dans ${Math.round(d / 30)} mois`;
}

function remainingLabel(days: number): string {
  if (days <= 0) return "dernier jour";
  if (days === 1) return "plus que 1 jour";
  return `${days} jours restants`;
}

export async function getSejourSnapshot(today: string): Promise<SejourSnapshot> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("start_date, end_date, families(name)")
      .eq("status", "approved")
      .gte("end_date", today)
      .order("start_date");

    if (error) throw error;

    const rows: Row[] = (data ?? []).map((b) => ({
      start_date: b.start_date as string,
      end_date: b.end_date as string,
      family: familyName((b as { families?: unknown }).families),
    }));

    const current =
      rows.find((r) => r.start_date <= today && r.end_date >= today) ?? null;

    // Prochaine arrivée = premier séjour qui commence strictement après aujourd'hui
    const next = rows.find((r) => r.start_date > today) ?? null;

    const stay: SejourStay | null = current
      ? {
          family: current.family,
          dates_label: formatRange(current.start_date, current.end_date),
          departure_label: `jusqu'au ${formatEndDate(current.end_date)}`,
          days_remaining: daysBetween(today, current.end_date),
          days_remaining_label: remainingLabel(
            daysBetween(today, current.end_date)
          ),
          progress_label: `Jour ${daysBetween(current.start_date, today) + 1}/${daysInRangeInclusive(
            current.start_date,
            current.end_date
          )}`,
        }
      : null;

    let nextBlock: SejourNext | null = null;
    if (next) {
      // Relais calculé par rapport à la fin du séjour courant (sinon vs aujourd'hui)
      const ref = current?.end_date ?? today;
      const diff = daysBetween(ref, next.start_date);
      nextBlock = {
        family: next.family,
        arrival_label: formatEndDate(next.start_date),
        countdown_label: countdownLabel(today, next.start_date),
        relay_label: getRelayPhrase(diff, next.family),
        is_pivot: diff === 0,
      };
    }

    return {
      status: current ? "occupied" : "free",
      stay,
      next: nextBlock,
    };
  } catch (e) {
    console.error(
      "[sejour] snapshot échec:",
      e instanceof Error ? `${e.name}: ${e.message}` : e
    );
    return { status: "free", stay: null, next: null };
  }
}
