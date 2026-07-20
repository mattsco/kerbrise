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
  type BookingSummary,
  type PendingApprovalBooking,
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

const SUMMARY_SELECT = `
  id, start_date, end_date, status, family_id,
  families(name, color)
`;

const PENDING_APPROVAL_SELECT = `id, family_id, approvals(family_id)`;

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

function mapSummaryBooking(b: any): BookingSummary {
  return {
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    status: b.status,
    family_id: b.family_id,
    family_name: b.families?.name ?? UNKNOWN_FAMILY_NAME,
    family_color: b.families?.color ?? UNKNOWN_FAMILY_COLOR,
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
 * Approved bookings whose stay isn't over yet (end_date >= fromISO), ordered
 * by start. Shared by the dashboard "prochains séjours" block and the sejour
 * snapshot. Pass `limit` to cap the result (dashboard shows 5).
 */
export async function getUpcomingApprovedBookings(
  supabase: SupabaseLike,
  fromISO: string,
  limit?: number
): Promise<BookingSummary[]> {
  let query = supabase
    .from("bookings")
    .select(SUMMARY_SELECT)
    .eq("status", "approved")
    .gte("end_date", fromISO)
    .order("start_date");

  if (limit !== undefined) query = query.limit(limit);

  const { data } = await query;
  return (data ?? []).map(mapSummaryBooking);
}

/**
 * Approved bookings that OVERLAP the [startISO, endISO] window
 * (start_date <= endISO AND end_date >= startISO). Used by the yearly stats
 * page, which clips each stay to the year. NB: overlap semantics — distinct
 * from getSummerBookings' "contained in" test.
 */
export async function getApprovedBookingsOverlappingRange(
  supabase: SupabaseLike,
  startISO: string,
  endISO: string
): Promise<BookingSummary[]> {
  const { data } = await supabase
    .from("bookings")
    .select(SUMMARY_SELECT)
    .eq("status", "approved")
    .lte("start_date", endISO)
    .gte("end_date", startISO)
    .order("start_date");

  return (data ?? []).map(mapSummaryBooking);
}

/**
 * Pending + approved bookings fully CONTAINED in the given year's summer
 * window (June 1 → Sept 30). Used by the summer-priority snapshot, which then
 * matches each booking against exact period dates. NB: containment semantics —
 * intentionally different from the overlap test above.
 */
export async function getSummerBookings(
  supabase: SupabaseLike,
  year: number
): Promise<BookingSummary[]> {
  const { data } = await supabase
    .from("bookings")
    .select(SUMMARY_SELECT)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .gte("start_date", `${year}-06-01`)
    .lte("end_date", `${year}-09-30`)
    .order("start_date");

  return (data ?? []).map(mapSummaryBooking);
}

/**
 * Pending + approved bookings that overlap the May "ponts" bridge window of a
 * given year (~20 avril → 20 juin, superset généreux couvrant tous les ponts de
 * mai possibles, Ascension/Pentecôte de début juin comprises). Le tri fin par
 * nuit est fait côté pur (lib/ponts.buildPontsState). Alimente le snapshot #38.
 */
export async function getMayBridgeBookings(
  supabase: SupabaseLike,
  year: number
): Promise<BookingSummary[]> {
  const { data } = await supabase
    .from("bookings")
    .select(SUMMARY_SELECT)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .lte("start_date", `${year}-06-20`)
    .gte("end_date", `${year}-04-20`)
    .order("start_date");

  return (data ?? []).map(mapSummaryBooking);
}

/**
 * Pending bookings from OTHER families (family_id != myFamilyId), each with
 * the list of families that already voted. Lets the dashboard count, and the
 * admin "simulate approvals" tool act on, the bookings still awaiting a given
 * family's decision — without re-querying the approvals tree.
 */
export async function getPendingBookingsAwaitingFamily(
  supabase: SupabaseLike,
  myFamilyId: string
): Promise<PendingApprovalBooking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(PENDING_APPROVAL_SELECT)
    .eq("status", "pending")
    .neq("family_id", myFamilyId);

  return (data ?? []).map((b: any) => ({
    id: b.id,
    family_id: b.family_id,
    approved_by_family_ids: (b.approvals ?? []).map((a: any) => a.family_id),
  }));
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
