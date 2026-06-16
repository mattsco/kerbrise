# Kerbrise — Notes de version

> Historique des versions livrées. Format inspiré de Keep a Changelog, SemVer (MAJEUR.MINEUR.PATCH).
> Pour ce qui est **à venir**, voir `ROADMAP.md`. Pour la version destinée à la famille, voir `docs/changelog.md`.

---

## [Unreleased]

### ✨ Ajouts
- **#26 — Conditions du jour dans la bannière** : quand un séjour est en cours (cas A/B), la bannière contextuelle du dashboard s'enrichit de lignes « conditions », **dans son propre style** (pas de widget) : icônes d'accent, valeurs en gras, labels atténués, coef en pastille douce. Contenu :
  - **marées** : les 2 prochaines à venir (heure + pleine/basse, flèches ↑/↓), calculées par rapport à l'heure de Paris (débordent sur demain en fin de journée), avec le **coef** en pastille (statique). Si le scraper tombe : repli `Marée du jour` + coef seul.
  - **température de l'eau** : valeur seule (sans label, l'icône goutte suffit).
  - **météo du jour** : min / max + **écart de la max vs hier** (« +2° vs hier »), et **coucher du soleil** aligné à droite.
  - **tendance de la semaine** : une phrase au ton léger générée par règles déterministes sur les 7 prochains jours (ex. « Grand beau et chaud toute la semaine, tu as de la chance »). Pas de LLM, pas d'invention.
  - Sources : **temp. eau** = **moyenne saisonnière statique** du mois (`lib/sea-temp.ts`, table 12 valeurs façon `tides.ts`), affichée « mer ~14° en juin » ; **marées** (heures) = scraper `maree.info` ; **météo** = Open-Meteo Forecast (min/max, écart vs hier via `past_days=1`, coucher du soleil, tendance 7j) ; **coef** = statique `lib/tides.ts`.
    - *Pourquoi la temp. eau est saisonnière et non « du jour »* : toutes les API marines testées surestiment fortement (Open-Meteo ~19°, Stormglass ~18° vs ~13° réels — modèles à maille large qui ne résolvent pas l'eau côtière froide), et les sources mesurées précises (cabaigne, letelegramme, lachainemeteo) sont derrière Cloudflare → **403 depuis une IP datacenter** (Vercel), problème partagé par toute automatisation serveur. La moyenne mensuelle committée donne le bon ordre de grandeur, stable, sans dépendance ni quota.
  - Fetch **côté serveur**, sous `<Suspense fallback={null}>`, **cachés** (Open-Meteo 2h, maree.info 3h), **timeout** (4-5s), **mode dégradé** ligne par ligne. Le scraping maree.info reste le maillon fragile assumé, isolé par cache + dégradation.
  - **Durcissement de l'existant** : `lib/maree-info.ts` (scraper cheerio préexistant, jamais branché) corrigé — bug de type `waterTemperature` (renvoyait la chaîne `"undefined"`, **seule erreur de compil du projet**), `no-store` → cache 3h, timeout + wrapper non-throwing `getSaintMaloTidesSafe`.
  - Nouveau `lib/conditions.ts` + composant `app/dashboard/BannerConditions.tsx` (rendu dans `ContextualBanner`).
  - **Scope coupé** : pas de recommandations d'événements (aucune source fiable — à ne ré-ouvrir qu'en curation admin manuelle). Cf. ROADMAP.
- **Endpoint `GET /api/term`** : expose les conditions #26 (marées du jour + coef, mer saisonnière, météo + écart vs hier + coucher du soleil + tendance semaine) en JSON pour le TRMNL, avec labels pré-formatés (le template Liquid n'affiche). Date calculée en `Europe/Paris` (`todayInParis()` ajouté à `lib/dates.ts`), route `force-dynamic` (sources tierces cachées en interne), blocs `null` si source en panne. **Sous-ensemble MVP non authentifié** (données non sensibles) de la spec `trmnl-sejour-display.md` ; l'endpoint complet `/api/trmnl/screen` (séjour + WiFi + switch d'écrans) reste à faire et devra être protégé par token.

---

## [1.2.0] — 14 juin 2026

### ✨ Ajouts
- **#31 CalendarDesktopView** : sur écran ≥768px le calendrier devient une vue année entière façon tableur (12 colonnes mois × 31 jours, week-ends grisés, fériés nommés, étiquette Famille (Nj) au premier jour du séjour — les repères du planning Excel historique), avec sidepanel : légende-filtre familles, navigation année, bouton nouvelle demande, bannière contextuelle, mes prochains séjours. Placeholders été inclus. Sous la grille, stats d'occupation de l'année affichée (jours + part par famille, total en % de l'année), comme le bas du planning Excel. La vue mobile 3 mois est inchangée. Spec `docs/specs/calendar-desktop-view.md` (✅).
- **#31 V2 — Vue Marées** : sélecteur Séjours / Marées dans le sidepanel (`SidepanelViewSwitcher`) qui recolore toute la grille année selon le coefficient de marée du jour (heatmap morte-eau → grande marée), avec légende des paliers sous la grille (`TideLegend`) à l'emplacement des stats d'occupation. Coefficients Saint-Malo committés en statique dans `lib/tides.ts` (2024-2027, indexation par position avec garde-fou de longueur de mois) — la question « source des données marées » est tranchée par un fichier annuel committé (`tideLevel()` mappe coef → palier, `getTideDay()` lu par `MonthColumn` en vue tides uniquement).
- **#22d Priority card** explicative dans le Profil — carte qui personnalise la règle de priorité de l'année (été, pont de mai, restrictions juin/septembre) selon la famille et les périodes déjà choisies. Spec `docs/specs/priority-card-profil.md`.
- **Email « créneau raccourci »** (`notify-reduced`) : quand un séjour approuvé est raccourci (nouvelle période incluse dans l'ancienne) et qu'il commence dans les 3 prochains mois, un email part aux 3 chefs pour signaler les jours libérés (calcul début/fin/deux côtés, sémantique nuits cohérente avec la contrainte overlap). Au-delà de 3 mois → relayé par le weekly digest. Borne 3 mois calculée côté trigger SQL (pas d'appel HTTP pour les séjours lointains). Migration `db/migrations/0005_email_reduced.sql`.

### 📧 #28 — Rapatriement & durcissement du système emails (livré)
- **Versioning complet de l'infra email** : les 4 Edge Functions (`notify-new-booking`, `notify-decision`, `notify-cancelled-approved`, `send-weekly-digest`) + la nouvelle `notify-reduced` sont désormais dans le repo (`supabase/functions/`), avec les triggers Postgres relais, les fonctions de marquage et le cron `pg_cron` versionnés dans `db/migrations/` (0002 triggers email, 0003 marquage, 0004 cron, 0005 reduced). Le **déclenchement DB est conservé** (il ne rate aucun événement, contrairement à des Server Actions vu les 2 chemins d'écriture).
- **Bug timezone corrigé** : `new Date(iso)` (qui décalait d'un jour sur un runtime derrière UTC) remplacé par `parseLocalDate` + formatage fixé `Europe/Paris` dans `_shared/dates.ts`. Bug dormant en prod (runtime UTC) mais neutralisé définitivement. Nouveaux helpers : `formatRange` (plage avec année unique), `todayInParis`.
- **Couche partagée `_shared/`** : `dates.ts`, `html.ts` (shell email + `escapeHtml` + minification), `families.ts` (couleurs, source unique alignée DB/app), `recipients.ts` (3 patterns destinataires), `templates/*` (5 templates purs `(data) => html`). Déduplication des templates auparavant copiés dans chaque fonction.
- **Refonte design des emails** : nouveau gabarit « carte postale mer » (bandeau image Saint-Malo + titre incrusté, badge coloré par type, CTA, footer). Squelette modifiable en un seul endroit.
- **Weekly digest restructuré en 3 parties** : (1) changements de la semaine (nouvelles confirmations / modifications / annulations, par prénom d'auteur), (2) **demandes en attente** — « X a fait une demande du A au B, en attente de validation par la/les famille(s) Y » (familles restantes calculées = 3 familles − auteur − déjà votées), (3) **prochains séjours** (liste plate triée par date, max 3). Le digest part désormais s'il y a des changements **OU** des demandes en attente (avant : uniquement `changed_this_week`).
- **Preview locale** des emails (`_dev/preview.ts`, `deno run`) : rend les variantes en `.html`, zéro envoi, zéro DB. Remplace les 3 modes test abandonnés.
- **Sécurité** : `SET search_path TO 'public'` ajouté aux 3 fonctions relais (étaient SECURITY DEFINER sans search_path). Aucun secret hardcodé (service_role_key lue depuis `vault.decrypted_secrets`).
- **Suppression du filtre `last_sign_in_at`** dans le ciblage des destinataires (+ des 4 comptes jamais connectés, supprimés). La donnée reste dans `auth.users` pour les stats admin. Le filtre était devenu nuisible (excluait un nouveau membre tant qu'il ne s'était pas connecté).
- **Minification HTML** des emails (`minifyEmailHtml`) : retire les retours à la ligne entre balises (Gmail web les interprétait comme fin de message et repliait le contenu derrière « ... »).

### 🔧 Technique / config
- `daysInRangeClipped` extraite de `stats/page.tsx` vers `lib/dates.ts` (clipping d'un séjour à une fenêtre) — partagée par la page Stats et les stats d'occupation du calendrier desktop.
- `LAUNCH_DATE` centralisée dans `lib/config.ts` (était dupliquée en dur dans profil + admin + admin/analytics).
- `getRelevantSummerYear` bascule désormais au 1er octobre (au lieu du 31 août) : en septembre, l'année d'été affichée (profil, règles, carte) passe à l'année suivante.

### 📐 Specs & architecture
- **Audit infra email** livré : `docs/architecture/EMAIL_AUDIT.md`. A réconcilié les 3 versions contradictoires et **invalidé la prémisse de #28** (on était déjà sur Resend depuis le 20 mai ; emails via 4 Edge Functions Deno déclenchées par triggers Postgres ; weekly via pg_cron). C'est cet audit qui a transformé #28 d'une « migration » en un « versioning ».
- **Spec #28 réécrite** (`docs/specs/email-migration.md`) post-audit, puis exécutée en 3 sessions (versioning+timezone / refonte design+digest / retrait filtre).


---

## [1.1.0] — 29 mai 2026

Grosse session de polish, perf et refonte mineure du flow été, suivie d'une passe de refactoring architecture (data layer, mutations).

### ✨ Ajouts
- Permissions sur le choix des périodes d'été : seul le chef de famille peut picker (flag `SUMMER_CHOICE_FREEDOM` dans `lib/config.ts` pour ouvrir à tous les membres si besoin un jour)
- Auto-assignment automatique de la priorité 3 quand les 2 autres familles ont choisi
- Vercel Speed Insights branché pour mesurer les perfs réelles
- Section "Quoi de neuf" en bas de À propos (#24), lue depuis `docs/changelog.md`
- Numéro de version affiché sur la page À propos (`APP_VERSION` centralisé dans `lib/config.ts`, source = package.json)

### ⚡ Améliorations perf
- Navigation back instantanée (`router.back()` + cache mémoire au lieu de refetch)
- Dashboard parallélisé (auth + profile + bookings en parallèle) → ~50-80ms gagnés
- Stats parallélisée → ~50ms gagnés
- Migration auth vers `requireAuthUser` (lecture cookie locale) → ~80-150ms gagnés par navigation
- Plus de polling 60s pour la collecte des ordures (timeout jusqu'à minuit)
- Memo + useCallback sur `CalendarDayCell` (90 cellules, plus de re-render inutile)
- Middleware : `event.waitUntil` au lieu de fire-and-forget
- #18 Images house.jpg / sunset.jpg migrées vers `next/image` (AVIF/WebP + tailles responsives) ; `next.config.js` configure `formats: [avif, webp]` — gros gain sur mobile (sunset ~330KB → ~40-60KB selon écran)

### 🎨 UI / UX
- Légende calendrier data-driven depuis `lib/families.ts`
- "F⏳" remplacé par le nom complet "François" avec truncate CSS
- Numéros du jour dans les cellules calendrier remontés (plus d'overlap avec les barres)
- Animations smooth entre les années dans Stats (transition fade légère au lieu du remount agressif)
- `BackButton` utilise `router.back()` partout pour la nav cohérente

### 🔧 Refactor / dette tech
- Split `AProposClient.tsx` (700 lignes) en 4 composants : IntroSection, LinksSection, ContactsSection + orchestrateur slim
- Split `BookingActions.tsx` (374 lignes) en 5 fichiers : BookingActions (orchestrateur 73 lignes) + 4 sous-composants par mode
- `lib/families.ts` : source unique de vérité pour les 3 familles (couleurs, noms, rotation été), élimination de 6 endroits dupliqués
- `lib/dates.ts` : helpers centralisés (`parseLocalDate`, `dateToISO`, `todayISO`, `daysBetween`, `daysInRangeInclusive`)
- `lib/hooks.ts` : `useSyncedState` (resync state avec props après `router.refresh`) et `useDailyValue` (auto-refresh à minuit)
- `lib/supabase/auth.ts` : `getAuthUser` (cookie-only, rapide) + `requireAuthUser` (redirige login)
- `lib/summer-state.ts` : helper `getSummerSnapshot(year)` pour l'état des périodes d'été (réutilisable par Server Actions et UI)
- `app/dashboard/calendrier/actions.ts` : Server Action `reservePlaceholder` avec auth, permissions et auto-assignment côté serveur

#### Passe architecture (data layer + mutations)
- Data layer `lib/data/` : `types.ts` (source unique des shapes : Booking, Profile, statuts…), `bookings.ts` (toute query bookings centralisée : `getCalendarBookings`, `listBookingsWithApprovals`, `getBookingDetail`, `getRelatedBookings`, `createBookingRequest`), `profile.ts` (`getCurrentProfile` caché + guards `requireAdmin`/`requireCalendarAdmin`). Élimine 6 copies divergentes de la query + mapper `any`.
- Migration des call-sites vers la data layer : calendrier/page, demandes/page, BookingDetailModal, NewBookingForm, admin/actions. Plus de `@ts-ignore` sur les jointures, plus de cast `as unknown as`.
- `lib/validation/booking.ts` : `validateBookingDates()` partagé entre NewBookingForm et BookingActionsEdit (règles max 60j, "min demain", admin bypass).
- `lib/ui/booking-display.tsx` : `StatusBadge` + formatters de dates dédupliqués (4 copies → 1).
- `components/booking-actions/useBookingMutation.ts` : hook factorisant le boilerplate client (submitting/error/router.refresh/onComplete) pour Edit/Cancel/Delete.
- Cohérence des mutations admin : nouvelle Server Action `adminCancelBooking` ; l'annulation admin passe désormais par une Server Action (comme edit/delete) au lieu d'un update client direct. Les 3 mutations admin partagent un seul chemin (`is_admin_created` + bypass triggers).
- `CalendarDayCell` : `CalendarEvent` devient un ré-export de `CalendarBooking` (type unique), `Calendar.tsx` / `MonthGrid.tsx` inchangés.
- #27 `admin/actions.ts` : guards via `requireAdmin`/`requireCalendarAdmin` partagés (sur la base `requireAuthUser`).

### 🗄️ Base de données
- Migration `db/migrations/0001_overlap_constraint.sql` : contrainte d'exclusion `EXCLUDE USING gist` sur les séjours approved (borne `[)`, pivots légaux). Le no-overlap devient une garantie DB, plus seulement un check advisory côté front.

### 🐛 Bug fixes
- #1 Icon PWA manquant : `/icon-192.png` → `/icon-196.png` dans `app/layout.tsx`
- #2 Bug timezone dans `a-propos/page.tsx` : `today.toISOString().slice(0,10)` après `setHours(0,0,0,0)` retournait toujours la veille en hiver Paris
- #3 Bug timezone dans `dashboard/page.tsx` : faux entre minuit et 1-2h Paris
- #2/#3 (suite) `demandes/page.tsx` : dernier `new Date(iso)` (UTC) remplacé par `parseLocalDate` via les formatters partagés — séjours qui s'affichaient un jour trop tôt en hiver
- #5 AProposClient : state stale après `router.refresh()` (useState initial value jamais mis à jour)
- #6 WebcamTimer : `beforeunload` ne loggait pas vraiment la session (manquait l'appel `navigator.sendBeacon`). Création de l'API route `/api/webcam-session` qui reçoit le beacon
- #7 `daysBetween` dans Stats : `Math.floor` → `Math.round` (off-by-1 aux changements DST mars/oct)
- #8 NewBookingForm : 3 sous-bugs corrigés
  - Pas de check d'overlap avec un booking existant côté front → bandeau rouge bloquant si chevauchement
  - Pas d'appel à `overlapsSummerPeriod` → bandeau ambre bloquant si chevauche une période d'été fixe
  - Race condition dans le useEffect qui fetch les adjacents (pas d'ignore flag)
- #12 Dead code dans BookingDetailModal : variable `showAdminActions` jamais utilisée

---

## [1.0.0] — 24 mai 2026

Première version publique de Kerbrise, déployée sur Vercel pour les 14 membres de la famille (3 familles : Antoine, Vincent, François).

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

- **Pendant une session** : noter les changements livrés. Si une version est en préparation, les regrouper sous une section `## [Unreleased]` en tête, puis la dater au moment du release.
- **Au release** (push notable visible par la famille) : créer `## [1.x.y] — date`, y déplacer les changements, mettre à jour `package.json` et `docs/changelog.md` (version famille).
- **Roadmap** : ce qui est *à faire* vit dans `ROADMAP.md`, pas ici. Un item fait quitte la roadmap et devient une ligne de version ici.
