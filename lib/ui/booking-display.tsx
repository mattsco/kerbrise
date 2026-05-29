// lib/ui/booking-display.tsx
//
// Presentation helpers that were duplicated across demandes/page,
// BookingDetailModal, NewBookingForm and SummerPlaceholderModal:
//   - the status badge config (label + tailwind colour per status)
//   - the date formatters
//
// IMPORTANT: every formatter here uses parseLocalDate (local midnight) rather
// than new Date(iso) (UTC). demandes/page.tsx currently used new Date(iso),
// which is the live timezone bug (#2/#3): a stay can render one day early in
// Paris winter. Routing that page through formatLong() below fixes it.

import { parseLocalDate } from "@/lib/dates";
import type { BookingStatus } from "@/lib/data/types";

// ---- Status badge -----------------------------------------------------------

export type StatusBadge = { label: string; color: string };

export const STATUS_BADGES: Record<BookingStatus, StatusBadge> = {
  pending: { label: "⏳ En attente", color: "bg-amber-100 text-amber-800" },
  approved: { label: "✅ Approuvée", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "❌ Refusée", color: "bg-red-100 text-red-800" },
  cancelled: { label: "🚫 Annulée", color: "bg-slate-100 text-slate-700" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const c = STATUS_BADGES[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}
    >
      {c.label}
    </span>
  );
}

// ---- Date formatters (local-time, single implementation) --------------------

/** "lundi 14 juillet 2026" */
export function formatLong(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "14 juillet 2026" — no weekday. Matches demandes/page's old formatDate. */
export function formatMedium(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "14 juil." */
export function formatShort(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
