// lib/data/types.ts
//
// Single source of truth for the shapes returned by the data layer.
// Before this file, every page/component redeclared an inline booking shape
// and reached for @ts-ignore on the joined `families` / `users` relations.
//
// Domain objects here are already mapped (camelCase, fallbacks applied),
// so consumers never touch a raw Supabase row again.

export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

/** A status that can still appear on the calendar / be acted upon. */
export const ACTIVE_STATUSES = ["pending", "approved"] as const;

/** Fallbacks used consistently everywhere a join might be null. */
export const UNKNOWN_FAMILY_NAME = "?";
export const UNKNOWN_FAMILY_COLOR = "#888";

/**
 * The minimal booking shape the calendar needs. Matches the existing
 * `events` mapping in calendrier/page.tsx exactly (id duplicated as bookingId,
 * snake_case dates kept because CalendarDayCell / summer-placeholders read them).
 */
export type CalendarBooking = {
  id: string;
  bookingId: string;
  start_date: string;
  end_date: string;
  family_id: string;
  family_name: string;
  color: string;
  status: "pending" | "approved";
};

/**
 * Lightweight booking row with the family join already mapped. Used by the
 * dashboard "upcoming", stats and summer queries — anywhere that needs
 * dates + family identity but not the full approvals tree.
 */
export type BookingSummary = {
  id: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  family_id: string;
  family_name: string;
  family_color: string;
};

/**
 * A pending booking from another family, with the ids of families that have
 * already approved it. Lets a caller compute "is my family's vote still
 * missing?" without re-fetching the approvals tree.
 */
export type PendingApprovalBooking = {
  id: string;
  family_id: string;
  approved_by_family_ids: string[];
};

/** A neighbouring booking used for adjacency / overlap UI. */
export type RelatedBooking = {
  id: string;
  start_date: string;
  end_date: string;
  family_name: string;
  family_color: string;
};

export type BookingApproval = {
  id: string;
  family_id: string;
  family_name: string;
  family_color: string;
  decision: "approved" | "rejected";
  decided_by_name: string;
};

/** Full detail used by BookingDetailModal. */
export type BookingDetail = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: BookingStatus;
  family_id: string;
  created_by: string;
  family_name: string;
  family_color: string;
  author_name: string;
  approvals: BookingApproval[];
  adjacent: RelatedBooking[];
};

/** Booking + approvals as listed on the demandes page. */
export type BookingWithApprovals = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: BookingStatus;
  family_id: string;
  created_by: string;
  created_at: string;
  family_name: string;
  family_color: string;
  author_name: string;
  approvals: {
    family_id: string;
    decision: "approved" | "rejected";
    family_name: string;
    family_color: string;
  }[];
};

/** The current user's profile, fetched once and shared. */
export type Profile = {
  id: string;
  display_name: string | null;
  family_id: string;
  family_name: string;
  family_color: string;
  is_family_head: boolean;
  is_admin: boolean;
  is_calendar_admin: boolean;
  password_changed: boolean;
};
