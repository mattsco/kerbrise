// lib/data/bookings.ts
//
// The ONLY module that knows how to query the `bookings` table.
// Each query has exactly one select string and one row -> domain mapper, so a
// column rename is one edit with full compiler help — not a 6-file find-replace.
//
// This file is import-safe from both Server Components (default) and Client
// Components: pass the already-created Supabase client in. That keeps the data
// layer agnostic about which client (browser vs server cookie-based) is used,
// which is exactly the split Kerbrise already relies on.

import { parseLocalDate, dateToISO } from "@/lib/dates";
import {
  ACTIVE_STATUSES,
  UNKNOWN_FAMILY_COLOR,
  UNKNOWN_FAMILY_NAME,
  type CalendarBooking,
  type BookingDetail,
  type BookingWithApprovals,
  type RelatedBooking,
} from "./types";

// Minimal structural type so we don't couple to a specific @supabase version.
type SupabaseLike = {
  from: (table: string) => any;
};

const ADJACENCY_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Select strings — declared once, reused. Keeping them as named constants
// makes the column set greppable and diffable.
// ---------------------------------------------------------------------------

const CALENDAR_SELECT = `
  id, start_date, end_date, status, family_id,
  families(name, color)
`;

const DETAIL_SELECT = `
  id, start_date, end_date, note, status, family_id, created_by,
  families(name, color),
  users:created_by(display_name)
`;

const APPROVALS_SELECT = `
  id, family_id, decision,
  families(name, color),
  users:decided_by(display_name)
`;

const RELATED_SELECT = `id, start_date, end_date, families(name, color)`;

const LIST_SELECT = `
  id, start_date, end_date, note, status, family_id, created_by, created_at,
  families(name, color),
  users:created_by(display_name),
  approvals(family_id, decision, families(name, color))
`;

// ---------------------------------------------------------------------------
// Mappers — the single home for the `?? "?" / "#888"` fallback convention.
// ---------------------------------------------------------------------------

function mapCalendarBooking(b: any): CalendarBooking {
  return {
    id: b.id,
    bookingId: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    family_id: b.family_id,
    family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
    color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
    status: b.status,
  };
}

function mapRelatedBooking(b: any): RelatedBooking {
  return {
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
    family_color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
  };
}

function mapListBooking(b: any): BookingWithApprovals {
  return {
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    note: b.note,
    status: b.status,
    family_id: b.family_id,
    created_by: b.created_by,
    created_at: b.created_at,
    family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
    family_color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
    author_name: b.users?.display_name ?? UNKNOWN_FAMILY_NAME,
    approvals: (b.approvals ?? []).map((a: any) => ({
      family_id: a.family_id,
      decision: a.decision,
      family_name: a.families?.name ?? UNKNOWN_FAMILY_NAME,
      family_color: a.families?.color ?? UNKNOWN_FAMILY_COLOR,
    })),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * All pending+approved bookings for the calendar, ordered by start.
 * Replaces the inline query+mapper in calendrier/page.tsx.
 */
export async function getCalendarBookings(
  supabase: SupabaseLike
): Promise<CalendarBooking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(CALENDAR_SELECT)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .order("start_date");

  return (data ?? []).map(mapCalendarBooking);
}

/**
 * All pending+approved bookings with approvals, for the demandes list.
 * Replaces the cast-heavy inline query in demandes/page.tsx.
 */
export async function listBookingsWithApprovals(
  supabase: SupabaseLike
): Promise<BookingWithApprovals[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(LIST_SELECT)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .order("start_date");

  if (error) throw error;
  return (data ?? []).map(mapListBooking);
}

/**
 * Bookings within ±window days of [start,end] that are strictly adjacent
 * (i.e. NOT overlapping). Shared by NewBookingForm and BookingDetailModal,
 * which both reimplemented this fetch+classification.
 *
 * Returns { adjacent, overlapping } so each caller picks what it needs:
 *  - NewBookingForm wants both (overlap => block submit)
 *  - BookingDetailModal wants only adjacent
 */
export async function getRelatedBookings(
  supabase: SupabaseLike,
  startISO: string,
  endISO: string,
  excludeBookingId?: string
): Promise<{ adjacent: RelatedBooking[]; overlapping: RelatedBooking[] }> {
  const startDate = parseLocalDate(startISO);
  const endDate = parseLocalDate(endISO);

  const before = new Date(startDate);
  before.setDate(before.getDate() - ADJACENCY_WINDOW_DAYS);
  const after = new Date(endDate);
  after.setDate(after.getDate() + ADJACENCY_WINDOW_DAYS);

  let query = supabase
    .from("bookings")
    .select(RELATED_SELECT)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .gte("end_date", dateToISO(before))
    .lte("start_date", dateToISO(after))
    .order("start_date");

  if (excludeBookingId) query = query.neq("id", excludeBookingId);

  const { data } = await query;
  const mapped = (data ?? []).map(mapRelatedBooking);

  const adjacent: RelatedBooking[] = [];
  const overlapping: RelatedBooking[] = [];
  for (const b of mapped) {
    // Adjacent = touches at the edge or fully outside; otherwise overlap.
    if (b.end_date <= startISO || b.start_date >= endISO) adjacent.push(b);
    else overlapping.push(b);
  }
  return { adjacent, overlapping };
}

/**
 * Full booking detail + approvals + adjacent stays for BookingDetailModal.
 * Returns null if the booking doesn't exist.
 */
export async function getBookingDetail(
  supabase: SupabaseLike,
  bookingId: string
): Promise<BookingDetail | null> {
  const { data: b } = await supabase
    .from("bookings")
    .select(DETAIL_SELECT)
    .eq("id", bookingId)
    .single();

  if (!b) return null;

  const { data: approvals } = await supabase
    .from("approvals")
    .select(APPROVALS_SELECT)
    .eq("booking_id", bookingId);

  const { adjacent } = await getRelatedBookings(
    supabase,
    b.start_date,
    b.end_date,
    bookingId
  );

  return {
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    note: b.note,
    status: b.status,
    family_id: b.family_id,
    created_by: b.created_by,
    family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
    family_color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
    author_name: b.users?.display_name ?? UNKNOWN_FAMILY_NAME,
    approvals: (approvals ?? []).map((a: any) => ({
      id: a.id,
      family_id: a.family_id,
      family_name: a.families?.name ?? UNKNOWN_FAMILY_NAME,
      family_color: a.families?.color ?? UNKNOWN_FAMILY_COLOR,
      decision: a.decision,
      decided_by_name: a.users?.display_name ?? UNKNOWN_FAMILY_NAME,
    })),
    adjacent,
  };
}

/**
 * Insert a normal (member-initiated) booking request.
 * Mirrors the existing client insert in NewBookingForm — status "pending",
 * RLS enforces who may insert. Returns the DB error message (if any) so the
 * caller can surface a real overlap-constraint violation to the user.
 */
export async function createBookingRequest(
  supabase: SupabaseLike,
  input: {
    familyId: string;
    userId: string;
    start: string;
    end: string;
    note: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("bookings").insert({
    family_id: input.familyId,
    created_by: input.userId,
    start_date: input.start,
    end_date: input.end,
    note: input.note,
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
