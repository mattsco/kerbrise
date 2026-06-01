# Kerbrise — Journal de développement

Format inspiré de [Keep a Changelog](https://keepachangelog.com/).
Versionning [SemVer](https://semver.org/) : MAJEUR.MINEUR.PATCH.

---

## [Unreleased] — en cours pour la 1.2.0
### ✨ Ajouts
- **#22d** Priority card explicative dans le Profil — carte qui personnalise la règle de priorité de l'année (été, pont de mai, restrictions juin/septembre) selon la famille et les périodes déjà choisies. Spec `docs/specs/priority-card-profil.md`.

### 🔧 Technique / config
- `LAUNCH_DATE` centralisée dans `lib/config.ts` (était dupliquée en dur dans profil + admin + admin/analytics).
- `getRelevantSummerYear` bascule désormais au **1er octobre** (au lieu du 31 août) : en septembre, l'année d'été affichée (profil, règles, carte) passe à l'année suivante.

### À faire — features visibles
- **#31** CalendarDesktopView : vue année façon tableur sur desktop (spec `docs/specs/calendar-desktop-view.md`)
- **#26** Mode "vacances" sur la home avec météo Saint-Malo, température mer, marées — *l'app devient app de vacances quand on est sur place*
- **#22b** Notifications email pour les choix de période d'été — *bloqué tant que #28 pas fait, prévu pour janvier 2027 (prochain cycle)*

### À faire — refactor / dette tech
- **#23** Animations Stats avec interpolation Framer Motion — *side-project sympa quand t'as 1-2h*
- **#30** Restructurer `/dashboard/admin` en vrai hub (`/admin/lab`, `/admin/data`, `/admin/product`) — spec `docs/specs/admin-hub-restructure.md`
- Remonter le message d'erreur de la contrainte SQL anti-overlap dans `NewBookingForm` (perdant de la race) + supprimer le `console.warn` devenu redondant dans `CalendarDayCell`
- Versionner le backend : exporter RLS + triggers + état du schéma dans `db/migrations/`
- Découper les pages `stats/page.tsx` (518 l.) et `admin/analytics/page.tsx` (848 l.) — *séparer fetch / agrégation / rendu*

### À faire — gros chantiers (sessions dédiées)
- **#28** Migration emails Supabase Edge Functions → Next.js + Resend
  - 3 modes test à coder dans `lib/config.ts` : `strong` (tout chez admin), `debug-cci` (admin en cci), `normal`
  - Inventaire emails à faire avant : nouvelle demande, approbation/rejet, autres types
  - ~2-3h sur 2-3 sessions
- **#29** Web Push notifications
  - Clés VAPID, service worker, table `push_subscriptions`, UI opt-in dans profil
  - À faire APRÈS #28
  - ~4-6h

### À faire — un jour peut-être
- **#14** Wifi password en DB (pas urgent, on le change jamais)
- **#25** Page admin "Config" pour éditer les flags `lib/config.ts` via UI (quand on aura 2-3 flags) — spec `docs/specs/config-page-admin.md`

### Décidé skippé
- **#4** Affichage visuel des overlaps dans CalendarDayCell — *règle anti-overlap déjà en place côté front, fix purement défensif*
- **#9** RLS placeholder été côté Supabase — *pas de hackers dans la famille, RLS protège déjà les queries*

---

## [1.1.0] — 29 mai 2026

> Grosse session de polish, perf et refonte mineure du flow été, suivie d'une passe de refactoring architecture (data layer, mutations).

### ✨ Ajouts
- Permissions sur le choix des périodes d'été : seul le chef de famille peut picker (flag `SUMMER_CHOICE_FREEDOM` dans `lib/config.ts` pour ouvrir à tous les membres si besoin un jour)
- Auto-assignment automatique de la priorité 3 quand les 2 autres familles ont choisi
- Vercel Speed Insights branché pour mesurer les perfs réelles
- Section "Quoi de neuf" en bas de À propos (#24), lue depuis `docs/changelog.md`
- Numéro de version affiché sur la page À propos (`APP_VERSION` centralisé dans `lib/config.ts`, source = `package.json`)

### ⚡ Améliorations perf
- Navigation back instantanée (`router.back()` + cache mémoire au lieu de refetch)
- Dashboard parallélisé (auth + profile + bookings en parallèle) → ~50-80ms gagnés
- Stats parallélisée → ~50ms gagnés
- Migration auth vers `requireAuthUser` (lecture cookie locale) → ~80-150ms gagnés par navigation
- Plus de polling 60s pour la collecte des ordures (timeout jusqu'à minuit)
- Memo + useCallback sur CalendarDayCell (90 cellules, plus de re-render inutile)
- Middleware : `event.waitUntil` au lieu de fire-and-forget
- **#18** Images `house.jpg` / `sunset.jpg` migrées vers `next/image` (AVIF/WebP + tailles responsives) ; `next.config.js` configure `formats: [avif, webp]` — gros gain sur mobile (sunset ~330KB → ~40-60KB selon écran)

### 🎨 UI / UX
- Légende calendrier data-driven depuis `lib/families.ts`
- "F⏳" remplacé par le nom complet "François" avec truncate CSS
- Numéros du jour dans les cellules calendrier remontés (plus d'overlap avec les barres)
- Animations smooth entre les années dans Stats (transition fade légère au lieu du remount agressif)
- BackButton utilise `router.back()` partout pour la nav cohérente

### 🔧 Refactor / dette tech
- Split `AProposClient.tsx` (700 lignes) en 4 composants : `IntroSection`, `LinksSection`, `ContactsSection` + orchestrateur slim
- Split `BookingActions.tsx` (374 lignes) en 5 fichiers : `BookingActions` (orchestrateur 73 lignes) + 4 sous-composants par mode
- `lib/families.ts` : source unique de vérité pour les 3 familles (couleurs, noms, rotation été), élimination de 6 endroits dupliqués
- `lib/dates.ts` : helpers centralisés (`parseLocalDate`, `dateToISO`, `todayISO`, `daysBetween`, `daysInRangeInclusive`)
- `lib/hooks.ts` : `useSyncedState` (resync state avec props après `router.refresh`) et `useDailyValue` (auto-refresh à minuit)
- `lib/supabase/auth.ts` : `getAuthUser` (cookie-only, rapide) + `requireAuthUser` (redirige login)
- `lib/summer-state.ts` : helper `getSummerSnapshot(year)` pour l'état des périodes d'été (réutilisable par Server Actions et UI)
- `app/dashboard/calendrier/actions.ts` : Server Action `reservePlaceholder` avec auth, permissions et auto-assignment côté serveur

#### Passe architecture (data layer + mutations)
- **Data layer `lib/data/`** : `types.ts` (source unique des shapes : `Booking`, `Profile`, statuts…), `bookings.ts` (toute query `bookings` centralisée : `getCalendarBookings`, `listBookingsWithApprovals`, `getBookingDetail`, `getRelatedBookings`, `createBookingRequest`), `profile.ts` (`getCurrentProfile` caché + guards `requireAdmin`/`requireCalendarAdmin`). Élimine 6 copies divergentes de la query + mapper `any`.
- Migration des call-sites vers la data layer : `calendrier/page`, `demandes/page`, `BookingDetailModal`, `NewBookingForm`, `admin/actions`. Plus de `@ts-ignore` sur les jointures, plus de cast `as unknown as`.
- **`lib/validation/booking.ts`** : `validateBookingDates()` partagé entre `NewBookingForm` et `BookingActionsEdit` (règles max 60j, "min demain", admin bypass).
- **`lib/ui/booking-display.tsx`** : `StatusBadge` + formatters de dates dédupliqués (4 copies → 1).
- **`components/booking-actions/useBookingMutation.ts`** : hook factorisant le boilerplate client (submitting/error/`router.refresh`/onComplete) pour Edit/Cancel/Delete.
- **Cohérence des mutations admin** : nouvelle Server Action `adminCancelBooking` ; l'annulation admin passe désormais par une Server Action (comme edit/delete) au lieu d'un update client direct. Les 3 mutations admin partagent un seul chemin (`is_admin_created` + bypass triggers).
- `CalendarDayCell` : `CalendarEvent` devient un ré-export de `CalendarBooking` (type unique), `Calendar.tsx` / `MonthGrid.tsx` inchangés.
- **#27** `admin/actions.ts` : guards via `requireAdmin`/`requireCalendarAdmin` partagés (sur la base `requireAuthUser`).

### 🗄️ Base de données
- Migration `db/migrations/0001_overlap_constraint.sql` : contrainte d'exclusion `EXCLUDE USING gist` sur les séjours `approved` (borne `[)`, pivots légaux). Le no-overlap devient une garantie DB, plus seulement un check advisory côté front.

### 🐛 Bug fixes
- **#1** Icon PWA manquant : `/icon-192.png` → `/icon-196.png` dans `app/layout.tsx`
- **#2** Bug timezone dans `a-propos/page.tsx` : `today.toISOString().slice(0,10)` après `setHours(0,0,0,0)` retournait toujours la veille en hiver Paris
- **#3** Bug timezone dans `dashboard/page.tsx` : faux entre minuit et 1-2h Paris
- **#2/#3 (suite)** `demandes/page.tsx` : dernier `new Date(iso)` (UTC) remplacé par `parseLocalDate` via les formatters partagés — séjours qui s'affichaient un jour trop tôt en hiver
- **#5** `AProposClient` : state stale après `router.refresh()` (useState initial value jamais mis à jour)
- **#6** WebcamTimer : `beforeunload` ne loggait pas vraiment la session (manquait l'appel `navigator.sendBeacon`). Création de l'API route `/api/webcam-session` qui reçoit le beacon
- **#7** `daysBetween` dans Stats : `Math.floor` → `Math.round` (off-by-1 aux changements DST mars/oct)
- **#8** `NewBookingForm` : 3 sous-bugs corrigés
  - Pas de check d'overlap avec un booking existant côté front → bandeau rouge bloquant si chevauchement
  - Pas d'appel à `overlapsSummerPeriod` → bandeau ambre bloquant si chevauche une période d'été fixe
  - Race condition dans le `useEffect` qui fetch les adjacents (pas d'ignore flag)
- **#12** Dead code dans `BookingDetailModal` : variable `showAdminActions` jamais utilisée

---

## [1.0.0] — 24 mai 2026

> Première version publique de Kerbrise, déployée sur Vercel pour les 14 membres de la famille (3 familles : Antoine, Vincent, François).

### 🎉 Stack & architecture
- Next.js 15 + React 19 + Supabase + Tailwind
- PWA mobile-first, hébergé sur Vercel
- Auth Supabase + RLS

### 📅 Fonctionnalités principales
- Calendrier de réservation 3 mois glissants
- Système de demandes avec validation par les 2 autres chefs de famille
- Système de rotation pour les périodes d'été (3 périodes × 3 familles en rotation)
- Dashboard avec bannière contextuelle (à venir / en cours / passé)
- Page Stats par année avec graphiques famille / mois / records
- Page Profil avec préférences utilisateur
- Page À propos partagée (intro, liens utiles, contacts pratiques)
- Webcam live de la maison
- Tracking de présence sur place ("currentlyAt")
- Espace admin avec analytics, locations, health, simulation d'approvals
- Emails de notification via Edge Function Supabase + Resend
- Détection PWA installée vs navigateur

---

## Comment maintenir ce fichier

À chaque session de dev importante :
1. **Pendant** la session : ajouter les items terminés dans `[Unreleased]` sous les bonnes catégories
2. **Quand on release** une version (= push notable que la famille voit) : créer une nouvelle section `[1.x.0] — date`, déplacer les items de `[Unreleased]` dedans, dater
3. **Catégories** :
   - ✨ Ajouts : nouvelles features visibles user
   - ⚡ Améliorations perf : ce qui rend l'app plus rapide / fluide
   - 🎨 UI / UX : changements visuels
   - 🔧 Refactor : invisible pour user, mais bouge le code
   - 🗄️ Base de données : migrations, contraintes, RLS
   - 🐛 Bug fixes
   - ⚠️ Breaking changes : si jamais on casse un comportement existant
