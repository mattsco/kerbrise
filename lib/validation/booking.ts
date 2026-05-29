// lib/validation/booking.ts
//
// The booking-date validation block was copy-pasted (with small drifts)
// between NewBookingForm and BookingActionsEdit. Centralising it both removes
// the duplication and puts the domain rules (max stay, "must be tomorrow") in
// one named place instead of as magic numbers in JSX components.

import { daysBetween, dateToISO } from "@/lib/dates";

/** Domain rules, named instead of inlined as literals. */
export const MAX_STAY_DAYS = 60;

export type BookingDateValidation =
  | { ok: true }
  | { ok: false; error: string };

type Options = {
  /**
   * Admin edits may correct history, so they skip the "max 60 days" and
   * "must start tomorrow" rules. Matches the existing isAdminMode behaviour
   * in BookingActionsEdit.
   */
  isAdminMode?: boolean;
};

/**
 * Validate a [start, end] booking range. Behaviour-identical to the checks
 * previously inlined in NewBookingForm.handleSubmit and
 * BookingActionsEdit.handleSave.
 */
export function validateBookingDates(
  start: string,
  end: string,
  { isAdminMode = false }: Options = {}
): BookingDateValidation {
  if (!start || !end) {
    return { ok: false, error: "Les deux dates sont requises." };
  }

  if (end < start) {
    return {
      ok: false,
      error: "La date de fin doit être après la date de début.",
    };
  }

  const diffDays = daysBetween(start, end);
  if (!isAdminMode && diffDays > MAX_STAY_DAYS) {
    return {
      ok: false,
      error: `La durée maximum est de ${MAX_STAY_DAYS} jours (${diffDays} demandés).`,
    };
  }

  if (!isAdminMode) {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (start < dateToISO(tomorrow)) {
      return { ok: false, error: "La date de début doit être au moins demain." };
    }
  }

  return { ok: true };
}
