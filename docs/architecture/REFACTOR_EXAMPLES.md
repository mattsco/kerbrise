# Refactor examples — before / after

These show how the new `lib/data`, `lib/validation`, and `lib/ui` modules collapse the duplicated call sites. **Every change below is behaviour-preserving** — same queries, same output, same UI. The point is to delete the copies, not to change what users see.

---

## 1. `calendrier/page.tsx` — calendar fetch

**Before** (inline query + `any` mapper + fallbacks):

```ts
const { data: bookings } = await supabase
  .from("bookings")
  .select(`id, start_date, end_date, status, family_id, families(name, color)`)
  .in("status", ["pending", "approved"])
  .order("start_date");

const events =
  bookings?.map((b: any) => ({
    id: b.id,
    bookingId: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    family_id: b.family_id,
    family_name: b.families?.name ?? "?",
    color: b.families?.color ?? "#888",
    status: b.status as "pending" | "approved",
  })) ?? [];
```

**After:**

```ts
import { getCalendarBookings } from "@/lib/data/bookings";

const events = await getCalendarBookings(supabase);
```

Nine lines of mapping → one call. The `CalendarEvent` shape in `CalendarDayCell` can now `import type { CalendarBooking }` instead of redeclaring it.

---

## 2. `demandes/page.tsx` — list + the live timezone bug

**Before** (note `as unknown as`, and `new Date(iso)` UTC bug):

```ts
const { data: bookings, error } = await supabase
  .from("bookings")
  .select(`id, start_date, ... approvals(family_id, decision, families(name, color))`)
  .in("status", ["pending", "approved"])
  .order("start_date");
// ...
const allBookings = (bookings ?? []) as unknown as BookingWithApprovals[];
// ...
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" });
  //     ^^^^^^^^^^^^^ UTC parse → renders one day early in Paris winter
}
```

**After:**

```ts
import { listBookingsWithApprovals } from "@/lib/data/bookings";
import { formatMedium, StatusBadge } from "@/lib/ui/booking-display";

const allBookings = await listBookingsWithApprovals(supabase); // typed, no cast
// replace local formatDate() with formatMedium() (parseLocalDate) → bug gone
// delete the local StatusBadge component → use the shared one
```

This single swap fixes backlog bug **#2/#3** for the demandes page and deletes the duplicated `StatusBadge`.

---

## 3. `BookingDetailModal.tsx` — detail fetch

**Before:** ~70 lines doing three queries (booking, approvals, ±7-day adjacency), three `any` mappers, an inline adjacency filter, and `@ts-ignore` on every join.

**After:**

```ts
import { getBookingDetail } from "@/lib/data/bookings";
import { STATUS_BADGES, formatLong, formatShort } from "@/lib/ui/booking-display";

useEffect(() => {
  const supabase = createClient();
  getBookingDetail(supabase, bookingId).then((b) => {
    setBooking(b);
    setLoading(false);
  });
}, [bookingId]);
```

The local `statusBadge` ternary and `formatDate`/`formatShort` helpers are deleted in favour of the shared ones. The `±7-day adjacency` logic now lives once in `getRelatedBookings`, shared with the form.

---

## 4. `NewBookingForm.tsx` — related fetch + validation

**Before:** an inline `useEffect` that builds the ±7-day window, queries, maps, and splits adjacent/overlapping; plus a validation block duplicated from `BookingActionsEdit`.

**After:**

```ts
import { getRelatedBookings, createBookingRequest } from "@/lib/data/bookings";
import { validateBookingDates } from "@/lib/validation/booking";

useEffect(() => {
  let ignore = false;
  if (!start || !end) { setAdjacent([]); setOverlapping([]); return; }
  const supabase = createClient();
  getRelatedBookings(supabase, start, end).then(({ adjacent, overlapping }) => {
    if (ignore) return;
    setAdjacent(adjacent);
    setOverlapping(overlapping);
  });
  return () => { ignore = true; };
}, [start, end]);

async function handleSubmit() {
  setError("");
  const v = validateBookingDates(start, end);
  if (!v.ok) { setError(v.error); return; }
  // ... summer + overlap UX checks unchanged ...
  setSubmitting(true);
  const supabase = createClient();
  const res = await createBookingRequest(supabase, {
    familyId, userId, start, end, note: note.trim() || null,
  });
  if (!res.ok) { setError("Erreur : " + res.error); setSubmitting(false); return; }
  onSuccess ? onSuccess() : router.push("/dashboard/demande-envoyee");
}
```

The `ignore` flag is preserved (good async hygiene already present). Once migration `0001` lands, `res.error` will carry the overlap-constraint message, closing the race window for the submit-loser.

---

## 5. `admin/actions.ts` — guards

**Before:** `checkAdmin()` and `checkCalendarAdmin()` each fetch the profile flag and throw, duplicated at the top of the file (and conceptually re-implemented in every page).

**After:**

```ts
import { requireAdmin, requireCalendarAdmin } from "@/lib/data/profile";
// delete the two local check* functions; call the shared ones.
```

Same throw-on-failure behaviour, one definition, and the cached `getCurrentProfile` means the guard + any later profile read in the same request share one round-trip.

---

## 6. `BookingActionsCancel` / `Delete` / `Edit` — mutation boilerplate

**Before:** each component owns `useRouter`, `submitting`, `error`, the try/await/`setError`/`router.refresh()`/`onComplete()` dance.

**After:**

```ts
import { useBookingMutation } from "./useBookingMutation";

const { submitting, error, run } = useBookingMutation();

async function handleCancel() {
  await run(async () => {
    const supabase = createClient();
    const { error } = await supabase.from("bookings").update({ /* ... */ }).eq("id", bookingId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }, onComplete);
}
```

Behaviour identical; ~10 lines removed per component and error handling guaranteed uniform.

---

## Suggested order

1. Drop in the new files (`lib/data/*`, `lib/validation/booking.ts`, `lib/ui/booking-display.tsx`, the hook). They're additive — nothing breaks yet.
2. Migrate call sites one file at a time (1 → 6 above), running the app after each. Diff the rendered output; it should be pixel-identical except the demandes timezone fix.
3. Apply `db/migrations/0001_overlap_constraint.sql` against a staging Supabase project first, decide `[]` vs `[)` for pivot days, then surface the error in `NewBookingForm` and delete the `CalendarDayCell` overlap `console.warn`.
4. Export your existing RLS/triggers into `db/migrations/` so the backend is finally in version control.
