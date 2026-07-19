# Kerbrise

[![CI](https://github.com/mattsco/kerbrise/actions/workflows/ci.yml/badge.svg)](https://github.com/mattsco/kerbrise/actions/workflows/ci.yml)

**A booking and coordination app for a shared family vacation home in Saint-Malo, France.**

One house, three family branches (~14 people), and a recurring summer scramble over who gets which week. Kerbrise replaces the spreadsheet-and-email ritual with a small, fast, boring-on-purpose web app: request a stay, get it approved, see the calendar, glance at the tides. Success is measured by invisibility, not engagement — if the family forgets the app exists and the house just works, it's doing its job.

Built and maintained solo. Live at **[kerbrise.fr](https://kerbrise.fr)** (private — family auth required), launched May 2026.

## Stack

- **Next.js 16 / React 19** — App Router, Server Components, Server Actions
- **Supabase** — Postgres, Row-Level Security, Auth (deployed in `eu-west-1`)
- **Tailwind CSS** + lucide-react
- **Resend** for transactional email
- **Vercel** deployment, shipped as an installable **PWA**
- TypeScript end to end

## What it does

- **Stay requests with a 2-of-3 approval rule.** Any family can request a date range; it becomes confirmed once two of the three branches approve. The rule lives in the database, not just the UI.
- **A calendar shaped by its primary user.** The desktop calendar was designed around an ~80-year-old family member's Excel planning habits — the layout deliberately mirrors how he already thinks about the year.
- **A summer rotation system** anchored to 2024 (Antoine → Vincent → François), cycling by `modulo 3`, with priority-week logic for the high season.
- **Live local context during a stay** — next tides + coefficient and the day's weather on the home screen, with embedded tide schedules so it stays correct even when external sources are down.
- **House utilities** — Wi-Fi password, Freebox reachability status, a TV how-to guide, bin schedule, Saint-Malo webcams.
- **An admin hub** for health diagnostics, analytics, a simulation lab, and product (roadmap + changelog).
- **Companion surfaces** — a TRMNL e-ink display for the living room and a Garmin Connect IQ tide widget read from the same data.

## Engineering decisions worth a look

This is a low-traffic family utility, but it's been treated as a place to make correct, defensible engineering calls. A few:

- **Atomic anti-overlap booking.** Two families could request the same week concurrently; a procedural `SELECT`-then-`INSERT` trigger let both through under load. Replaced with a Postgres `EXCLUDE USING gist` constraint that serializes at the database level — scoped to confirmed stays only, so contested summer weeks can still coexist until arbitrated.
- **Local JWT verification.** The middleware was calling Supabase Auth on *every* request (~40 ms median, 577 ms cold). Migrated to `getClaims()` with local ES256 signature verification via cached JWKS (Web Crypto) — **~5 ms median, region-independent (~8× faster)** — while keeping token refresh intact and falling back to a network check if local verification isn't possible.
- **Constraint-enforced voting integrity.** A `UNIQUE (booking_id, family_id)` constraint plus a `count(distinct family_id)` rewrite stop a single family from self-approving by voting multiple times.
- **Error handling by SQLSTATE, not regex.** Raw Postgres violations (`23505`, `23P01`) are translated to French user messages by SQL state code — robust across PG versions and locales.
- **Versioned schema.** The full database — 7 tables, 16 functions, 11 triggers, 21 RLS policies — is captured as ordered SQL migrations rather than living only in the Supabase dashboard.
- **Dependency-conscious UI.** Stats animations (count-ups, cascading bars, `prefers-reduced-motion` aware) were built in ~1 KB of CSS + a small client component instead of pulling in a ~40 KB animation library, keeping the page otherwise fully server-rendered.

## Repository layout

```
app/            Next.js App Router — routes, server actions, API handlers
components/     React components (calendar, booking flow, admin, PWA)
lib/            Domain logic — tides, families, dates, Supabase clients, data layer
db/             Versioned SQL migrations (baseline + incremental)
supabase/       Supabase project config
docs/           Architecture review, specs, changelogs, guides
garmin/         Connect IQ tide widget
trmnl-plugin/   E-ink living-room display
public/         Static assets, PWA manifest & icons
```

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

Requires a `.env.local` with Supabase and Resend credentials (not committed). The app expects a provisioned Supabase project with the schema from `db/migrations` applied.

## Documentation

- `CHANGELOG.md` — full developer changelog (the technical reasoning behind each release)
- `docs/changelog.md` — family-facing release notes
- `ROADMAP.md` — what's next
- `docs/architecture/KERBRISE_REVIEW.md` — a candid senior-engineering self-review of the codebase

## Status

Active, in production for the family. This is a personal project; the code is shared for reference and not licensed for reuse.
