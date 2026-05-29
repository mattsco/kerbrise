# Kerbrise — Senior Engineering Review

*Onboarding review of the codebase as it stands. Goal: improve code quality, scalability, and maintainability without changing behaviour.*

---

## 1. Architecture, reverse-engineered

Kerbrise is a Next.js 15 (App Router) + React 19 PWA on top of Supabase (Postgres + Auth + RLS), mobile-first, ~10.7k LOC. It lets ~14 users across 3 families (Antoine / Vincent / François) reserve a shared house.

**Layers as they exist today**

- **Auth / session**: `middleware.ts` validates the JWT on every request via `getUser()` (the one real Supabase round-trip) and refreshes cookies. `lib/supabase/auth.ts` then exposes `getAuthUser()` / `requireAuthUser()`, which read the cookie locally via `getSession()` (cheap) and are wrapped in React `cache()` for per-render dedupe. Pages call `requireAuthUser()` for the gate, then a separate `createClient()` for data. This split is sound and already well-reasoned.
- **Data access**: there is **no data layer**. Every page and several client components call `supabase.from("bookings").select(...)` inline with hand-written column strings and `(b: any)` mappers. Reads happen both server-side (pages) and client-side (`BookingDetailModal`, `NewBookingForm`).
- **Domain logic** (`lib/`): this is the strong part. `dates.ts`, `families.ts`, `summer-priorities.ts`, `summer-placeholders.ts`, `summer-state.ts`, `dashboard-banner.ts`, `garbage-collection.ts`, `holidays.ts` are pure, well-documented, and mostly free of duplication. The summer-priority rotation and placeholder logic are genuinely clean.
- **Writes**: two parallel paths. (a) **Client-direct mutations** through the browser Supabase client (new booking, approve/reject, edit, cancel) relying on RLS for authz. (b) **Server Actions** in `admin/actions.ts` + `calendrier/actions.ts` for admin/privileged operations, which set `is_admin_created: true` to bypass DB email triggers.
- **UI**: Server Components fetch + render; interactive bits (`Calendar`, modals, forms) are Client Components. The calendar is well-decomposed: `Calendar.tsx` (state + memoized maps) → `MonthGrid.tsx` → memoized `CalendarDayCell.tsx`.

**Data flow for the central use case (request a stay)**

1. User taps two days in `Calendar` → `NewBookingModal` → `NewBookingForm`.
2. Form fetches nearby bookings client-side to show overlaps/adjacency, validates client-side (dates, 60-day cap, summer-period collision), then **inserts directly** with `status: "pending"`.
3. A DB trigger (inferred, not in repo) emails the 3 family heads.
4. Heads open `BookingDetailModal` / `demandes` → `ApprovalButtons` inserts an `approvals` row. Approval count + status transitions are enforced server-side in Postgres (also inferred).
5. Calendar re-fetches on `router.refresh()`.

The inferred DB pieces (triggers, RLS policies, the approval state machine) are **the real backend** and are not in this repo. That is itself the single biggest architectural risk (see §4).

---

## 2. What is already good

Worth saying explicitly, because it shapes the recommendations:

- `lib/` domain modules are pure and testable; the "memory backlog" refactors #10 (`families.ts`) and #11 (`dates.ts`) are **done** and adopted.
- Calendar perf work is **done**: `eventsByDate` is hoisted into `Calendar.tsx` and shared across the 3 `MonthGrid`s; `CalendarDayCell` is `memo`'d with stable `useCallback` handlers; `today` is a `useMemo`; ISO day strings are built without `new Date()` per cell.
- `BookingActions` is already split by mode (#13 done).
- The auth fast-path (`getSession` behind a middleware `getUser`) is correct and saves ~100ms/page.
- `middleware.ts` correctly uses `event.waitUntil()` for the fire-and-forget `last_seen` update (#20 partly addressed).

This is a mid-cleanup codebase, not a greenfield mess. The remaining issues are concentrated in **data access** and a handful of **correctness bugs**.

---

## 3. Bad architecture decisions

**3.1 No data-access layer — the dominant problem.**
The same `bookings` query (select string + `families(name,color)` join + `(b:any)` → camelCase mapping + `?? "?" / "#888"` fallbacks) is re-implemented in at least six places: `calendrier/page.tsx`, `dashboard/page.tsx`, `demandes/page.tsx`, `BookingDetailModal.tsx`, `NewBookingForm.tsx`, and `summer-state.ts`. Each copy can drift in its column list, its status filter, and its fallbacks. There is no single `Booking` type — every file redeclares an inline shape and reaches for `@ts-ignore` on the joined `families`/`users` relations.

**3.2 Authorization split across three enforcement points with no single source of truth.**
Authz currently lives in: RLS (DB), client-side guards (`canEditOrCancelNormal`, `canApprove` in the modal), and server actions (`checkAdmin` / `checkCalendarAdmin`). The client guards are UX-only but are written as if they were security. `updateFeatureRequestStatus` literally comments `// RLS enforce que seul un admin peut updater` while only calling `requireAuthUser()` — so the *entire* admin authority for that action is delegated to a policy that isn't visible in this repo. If that RLS policy is ever wrong or missing, any authenticated user can change feature-request status. The pattern of "trust RLS" is fine, but it must be **explicit and verified**, not implied by a comment.

**3.3 Two write paths with divergent side-effects.**
Normal edits/cancels go through the **browser** client; admin ones go through **server actions** that set `is_admin_created`. `BookingActionsCancel` is the sharp edge: in admin mode it does a *client-side* update with `is_admin_created: true`, but the bypass-email logic for admin elsewhere lives in server actions. So "admin cancel" takes a different code path than "admin edit"/"admin delete", and whether the email trigger actually fires depends on subtle ordering in the DB trigger. This is fragile and untestable from the app side.

**3.4 The backend isn't in the repo.**
RLS policies, the approval→status state machine, and the email triggers are the core business rules, and they live only in the Supabase dashboard. There's no migrations folder, so the schema isn't version-controlled, can't be code-reviewed, and can't be reproduced in a fresh project. For a 14-user app this is survivable, but it's the thing most likely to cause a silent production incident.

**3.5 `console.warn` overlap guard is a symptom.**
`MonthGrid` warns (dev-only) when >2 events land on one day. Per your own backlog you skipped fixing this pending confirmation that the server enforces non-overlap. That confirmation is exactly the kind of invariant that should be a DB exclusion constraint, not a client-side `console.warn`.

---

## 4. Scalability & correctness risks

For 14 users, raw load is a non-issue. The risks are about **correctness** and **future-you maintaining it**, which I'm treating as the real "scalability" axis here.

**4.1 Client-side overlap check is advisory, not authoritative (race condition).**
`NewBookingForm` fetches neighbours and disables submit on overlap, but two members can pass the check simultaneously and both insert. Unless the DB has an exclusion constraint (`tstzrange` `EXCLUDE USING gist`), double-bookings are possible. The `console.warn` in §3.5 is the same invariant leaking through the UI. **This is the one risk worth hardening even at 14 users**, because a double-booked summer week causes a real family argument.

**4.2 `summer-state.getSummerSnapshot` is called 2–3× per reservation.**
`reservePlaceholder` calls `getSummerSnapshot` (a DB round-trip) before insert, then **again** after to drive auto-assignment, plus `getFamilyHeadByName` does two more queries. The auto-assignment insert is also **not transactional** with the user's insert — if it fails, you've got a half-applied summer rotation and a code comment that says "admin can fix it manually". For a once-a-year, three-clicks-total flow this is acceptable, but it should at least be a single Postgres function (RPC) so the rotation is atomic.

**4.3 Per-request middleware DB write.**
Throttled to 15 min via a **module-level `Map`** that the file's own comment admits is unreliable on Edge cold starts. Fine at this scale; just know it's best-effort and will occasionally double-write. Don't build anything on top of `last_seen` accuracy.

**4.4 N sequential inserts in `simulateApprovals`.**
Loops `await insert` one booking at a time. Admin-only simulation tool, low stakes, but it's an easy `insert([...])` batch.

**4.5 Image weight.**
`/house.jpg` and `/sunset.jpg` are served as raw `<img>` (688KB + 776KB per your notes), `icon-512.png` is 424KB. On a mobile-first PWA over 4G this is the biggest *real* user-facing perf cost in the app — bigger than any query. `next/image` + recompression (backlog #18/#19) is the highest-ROI perf task.

---

## 5. Duplicate logic (concrete)

| Logic | Duplicated in |
|---|---|
| `bookings` select + `families` join + `any`→object mapper + `"?"/"#888"` fallbacks | `calendrier/page`, `dashboard/page`, `demandes/page`, `BookingDetailModal`, `NewBookingForm`, `summer-state` |
| ±7-day "adjacent vs overlapping" fetch + classification | `NewBookingForm`, `BookingDetailModal` |
| `profile` fetch (`family_id, is_family_head, …, families(name)`) | every dashboard page, both server actions |
| Validation block (both dates required / end≥start / >60 days / start≥tomorrow) | `NewBookingForm`, `BookingActionsEdit` |
| Status badge config (label+colour per status) | `demandes/page` (`StatusBadge`) and `BookingDetailModal` (`statusBadge`) |
| Family approval-row rendering (`FAMILY_NAMES.map` → self/approved/rejected/pending) | `demandes/page` (`ApprovalStatus`) and `BookingDetailModal` |
| `formatShort` / `formatDate` (`parseLocalDate` → `toLocaleDateString`) | `NewBookingForm`, `BookingDetailModal`, `SummerPlaceholderModal`, `demandes/page` |
| `checkAdmin` / `checkCalendarAdmin` (fetch profile flag, throw) | `admin/actions.ts` (and the implicit version in every page) |

Note: `demandes/page.tsx`'s `formatDate` uses `new Date(iso)` (UTC parse) while everywhere else uses `parseLocalDate`. That's the **exact timezone bug** from backlog items #2/#3, still live here — a stay can render one day early in Paris winter.

---

## 6. Maintainability issues

- **`@ts-ignore` on every joined relation.** Supabase's typed client can generate these types (`supabase gen types typescript`); right now the joins are untyped and silently `any`.
- **`(b: any)` mappers everywhere.** No shared row→domain mapping, so a column rename is a find-replace across 6 files with no compiler help.
- **Inline 800-line pages.** `admin/analytics/page.tsx` (848) and `stats/page.tsx` (518) mix data fetching, aggregation, and a full presentational tree in one Server Component. Hard to read, impossible to unit-test the aggregation.
- **Magic numbers & strings** scattered: `60` (max days), `7` (adjacency window), `2` (stay-active grace), `["pending","approved"]`, the `is_admin_created` bypass flag. These are domain rules that belong in one constants module.
- **Mixed languages in identifiers** is fine and consistent (French domain terms), no complaint there.

---

## 7. Clean architecture (target)

Keep the existing layering — it's mostly right — and insert the missing layer:

```
app/(routes)          Server Components: auth gate + call data layer + render
components/           Client Components: presentation + call data layer / actions
lib/
  data/               NEW. The only place that talks to supabase about a table.
    bookings.ts         getCalendarBookings(), getBookingDetail(),
                        getRelatedBookings(), createBookingRequest()
    profile.ts          getCurrentProfile()  (typed, cached)
    types.ts            Booking, BookingStatus, Profile, Approval — one source
  domain/             pure logic (your existing summer-*, dates, families, banner)
  validation/         NEW. validateBookingDates() shared by form + edit
  ui/                 NEW. statusBadge config, formatDate helpers (1 copy)
  supabase/           clients + auth (unchanged)
db/migrations/        NEW. RLS policies, triggers, the EXCLUDE overlap constraint,
                        approval state machine — version-controlled at last.
```

Rules: components never write a `.from("table")` query; they call `lib/data/*`. Each table has exactly one select-string and one row→domain mapper. Authz invariants are written **once in SQL** (migrations folder) and the app *assumes* them rather than re-implementing UX-only mirrors as if they were security.

---

## 8. Critical problem areas (ranked)

1. **Overlap/double-booking is not provably prevented** (§4.1). Add a Postgres `EXCLUDE` constraint on approved bookings; surface the resulting insert error in `NewBookingForm` instead of relying on the advisory client check. *Highest correctness value.*
2. **No data layer** (§3.1, §5). Six divergent copies of the bookings query. Consolidate into `lib/data/bookings.ts`. *Highest maintainability value.*
3. **Schema/RLS/triggers not in repo** (§3.4). Export them into `db/migrations/`. *Highest "won't get paged at 11pm" value.*
4. **`demandes/page` timezone bug** (§5). One-line fix: `parseLocalDate` instead of `new Date`. *Live user-visible bug.*
5. **Admin-cancel takes a client path while admin-edit/delete take server paths** (§3.3). Route all admin mutations through server actions.
6. **Summer auto-assignment isn't atomic** (§4.2). Move to an RPC.
7. **Images** (§4.5). `next/image` + recompress. *Highest real perf value.*

---

## 9. Refactoring strategy (incremental, behaviour-preserving)

Do these in order; each is independently shippable and none changes behaviour.

**Step 1 — Types + data layer, read side.** Create `lib/data/types.ts` and `lib/data/bookings.ts` with `getCalendarBookings()`, `getBookingDetail()`, `getRelatedBookings()`. Replace the inline queries in the 3 pages + 2 components one at a time, asserting identical output. No UI change.

**Step 2 — Shared validation + UI helpers.** Extract `validateBookingDates()` and the status-badge/format helpers. Point `NewBookingForm`, `BookingActionsEdit`, `demandes/page`, `BookingDetailModal` at them. This also kills the timezone bug for free.

**Step 3 — Write side.** Add `createBookingRequest()` to the data layer (wraps the client insert). Route admin-cancel through a server action so all three admin mutations share one path.

**Step 4 — DB hardening.** Export current RLS/triggers into `db/migrations/`, add the overlap `EXCLUDE` constraint, convert summer reservation+auto-assign into one RPC.

**Step 5 — Assets.** `next/image` + recompress.

I've implemented Steps 1 and 2 below as production-grade, drop-in code, since they're the foundation everything else builds on and they're 100% behaviour-preserving.

See the accompanying files:
- `lib/data/types.ts`
- `lib/data/bookings.ts`
- `lib/data/profile.ts`
- `lib/validation/booking.ts`
- `lib/ui/booking-display.tsx`
- `components/booking-actions/useBookingMutation.ts`
- `db/migrations/0001_overlap_constraint.sql` (the one DB change I'd push first)
- `REFACTOR_EXAMPLES.md` — before/after showing the call-site diffs.
