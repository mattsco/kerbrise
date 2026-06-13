# Kerbrise — Journal de développement

> Format inspiré de Keep a Changelog. Versionning SemVer : MAJEUR.MINEUR.PATCH.
> Ce fichier sert aussi de **roadmap** (sections "À faire" par horizon) et de **réserve de prompts** pour les sessions de dev.

---

## [Unreleased] — en cours pour la 1.2.0

### ✨ Ajouts
- **#31 CalendarDesktopView** : sur écran ≥768px le calendrier devient une vue année entière façon tableur (12 colonnes mois × 31 jours, week-ends grisés, fériés nommés, étiquette Famille (Nj) au premier jour du séjour — les repères du planning Excel historique), avec sidepanel : légende-filtre familles, navigation année, bouton nouvelle demande, bannière contextuelle, mes prochains séjours. Placeholders été inclus. Sous la grille, stats d'occupation de l'année affichée (jours + part par famille, total en % de l'année), comme le bas du planning Excel. La vue mobile 3 mois est inchangée. Spec `docs/specs/calendar-desktop-view.md` (✅).
- **#22d Priority card** explicative dans le Profil — carte qui personnalise la règle de priorité de l'année (été, pont de mai, restrictions juin/septembre) selon la famille et les périodes déjà choisies. Spec `docs/specs/priority-card-profil.md`.

### 🔧 Technique / config
- `daysInRangeClipped` extraite de `stats/page.tsx` vers `lib/dates.ts` (clipping d'un séjour à une fenêtre) — partagée par la page Stats et les stats d'occupation du calendrier desktop.
- `LAUNCH_DATE` centralisée dans `lib/config.ts` (était dupliquée en dur dans profil + admin + admin/analytics).
- `getRelevantSummerYear` bascule désormais au 1er octobre (au lieu du 31 août) : en septembre, l'année d'été affichée (profil, règles, carte) passe à l'année suivante.

### 📐 Specs & architecture (préparation #28)
- **Audit infra email** livré : `docs/architecture/EMAIL_AUDIT.md`. Réconcilie les 3 versions contradictoires. Faits établis : on est **déjà sur Resend** (depuis le 20 mai) ; les emails partent de **4 Edge Functions Deno** (pas 1) déclenchées par **triggers Postgres** via `net.http_post` (les triggers relaient, ils n'envoient pas) ; le weekly digest vit dans **pg_cron** (dimanche 11h UTC → `send-weekly-digest`) ; les logs Resend révèlent une bascule Node→Edge pendant la semaine de lancement ; l'auth tourne sur le SMTP **défaut Supabase** (custom désactivé).
- **Spec #28 réécrite** (`docs/specs/email-migration.md`) après l'audit, qui en a invalidé la prémisse. Changements de direction actés : (1) **pas de migration** Server Actions — on **versionne** l'existant (Edge Functions + triggers + cron dans le repo), le déclenchement DB est conservé car il ne rate aucun événement (les 2 chemins d'écriture rendraient les Server Actions risquées) ; (2) les **3 modes test abandonnés** au profit d'une **preview locale** (zéro envoi) ; (3) checkbox admin « envoyer ou non » = pilote `is_admin_created` ; (4) suppression du filtre `last_sign_in_at` (+ des 4 comptes inactifs) ; (5) bug timezone `new Date(iso)` à corriger dans les 4 fonctions.

---

## Roadmap

> Re-séquencée juin 2026. Principe : l'app dort entre juillet et octobre (toutes les résas été sont faites, la prochaine vraie activité = planification 2027 entre novembre et février). La saison dicte les priorités, pas un ratio impact/effort abstrait.

### 🗓️ Juin 2026 — avant le départ en vacances

1. ~~**Audit infra email (1h)**~~ ✅ **Fait** (juin 2026) — `docs/architecture/EMAIL_AUDIT.md` livré. Les 3 versions contradictoires sont tranchées (résumé dans `[Unreleased]` ci-dessus). A invalidé la prémisse de #28 → spec réécrite.
2. **#26-lite Mode vacances lite** — **deadline 22 juin** — carte sur le dashboard quand un séjour est en cours : liens météo / marées / température mer Saint-Malo, zéro appel API. La version complète (#26) viendra cet été. → **Prompt 2**.
3. **#28 Rapatriement & durcissement du système emails** — spec `docs/specs/email-migration.md` (réécrite post-audit). **Prémisse corrigée par l'audit** : on est déjà sur Resend, rien à migrer côté provider. Le chantier n'est pas une refonte mais un **versioning** : rapatrier les 4 Edge Functions + les triggers + le cron pg_cron dans le repo (`supabase/functions/` + `db/migrations/`), **en gardant le déclenchement DB** (il ne rate aucun événement, contrairement à des Server Actions vu nos 2 chemins d'écriture). Au passage : corriger le bug timezone (`new Date(iso)` dans les 4 fonctions), dédupliquer les templates dans un `_shared/`, supprimer le filtre `last_sign_in_at` (+ les 4 comptes inactifs), **preview locale** des emails (remplace les 3 modes test abandonnés), checkbox admin « envoyer ou non » (pilote `is_admin_created`). #22b s'appuiera sur l'infra `_shared/` mise en place ici, mais son **vrai prérequis fonctionnel** est la liste de pendings actionnables du weekly (item sept-oct « récap des décisions en souffrance »), pas #28 seul. **Deadline réelle : 1er novembre** ; si inachevé au départ en vacances, flag de retour au legacy, pas d'état hybride non flaggé. → **Prompt 3**.
4. **Fix erreur overlap (~1h, à glisser dans une session #28)** — la contrainte EXCLUDE ne porte que sur les séjours `approved` : elle se déclenche à l'**approbation finale** (UPDATE de statut), pas à l'INSERT. Scénario : deux demandes chevauchantes soumises à quelques secondes d'intervalle, toutes deux pending ; la première est approuvée ; le clic Approuver sur la seconde viole la contrainte → échec muet, demande zombie. Catcher l'erreur (code 23P01) dans `ApprovalButtons.tsx` (et **pas** `NewBookingForm` comme noté précédemment) avec message clair + supprimer le `console.warn` devenu redondant dans `CalendarDayCell`.

### 🏖️ Été 2026 — sur place, rythme vacances

- **#26 Mode vacances complet** : APIs météo + marées + température mer ; unifier la surface "la maison maintenant" aujourd'hui dispersée en 4 fragments (webcam, currentlyAt, poubelles, météo).
- **#14 (évolué) Monitoring wifi par Raspberry Pi** : RPi sur place qui ping internet toutes les 5 min, statut wifi de la maison visible dans l'app. Côté app codable avant ; installation physique sur place. Le mot de passe wifi rejoint les infos pratiques d'À propos (l'ex-#14 "password en DB" est absorbé).
- **Documents & infos pratiques dans À propos** : manuels, assurance, infos d'arrivée — au fil de l'eau. C'est le rôle confirmé de la page À propos, pas d'une nouvelle surface.

### 🍂 Septembre–octobre 2026

- **Versionner le backend** : export complet RLS + état du schéma dans `db/migrations/` (au-delà de 0001). La vraie logique métier (state machine d'approbation) vit encore hors repo. ⚠️ **Chevauchement #28** : la session 1 de #28 versionne déjà les triggers/fonctions email + le cron. Cet item devient le **reste** — RLS policies, state machine d'approbation, contraintes — soit fait dans la foulée de #28, soit après. Ne pas dupliquer l'export des objets email.
- **Weekly digest = récap des décisions en souffrance** (prérequis de #22b) — principe unique : *toute décision en attente d'un acteur identifié qui ne l'a pas prise est relancée chaque semaine, tant qu'elle reste en attente.* Aujourd'hui le digest ne part que s'il y a eu des mises à jour (`changed_this_week`) — il rate exactement le cas où un rappel sert : quand rien n'a bougé parce que quelqu'un n'a pas agi. Implémentation au bon niveau d'abstraction : une **liste typée de « pendings actionnables »** `{ acteur, type, since }`, et le weekly itère dessus pour relancer. **Deux producteurs aujourd'hui** : (1) une demande pending non votée → relance les chefs concernés ; (2) à partir de janvier, via #22b : une famille n'a pas choisi sa période été → relance cette famille. Une demande non votée et une période non choisie sont le **même objet** sous deux formes. `[Hypothèse]` Seuil de relance X = 3 jours avant la première (assez pour ne pas harceler, assez court pour qu'une décision ne dorme pas une semaine) — à confirmer. ⚠️ **Ne pas sur-construire** : pas de registry ni de moteur de règles configurable — 2 producteurs derrière une même forme, extensible *quand* un 3ᵉ cas arrive, pas avant. **Dépendances** : à faire **après** le rapatriement #28 (le digest doit déjà vivre dans le repo) ; **bloque l'activation janvier de #22b** (qui est le 2ᵉ producteur — sans cette liste, pas de moteur d'envoi). Changement de logique métier, distinct du versioning #28. → spec à écrire le moment venu.
- **Export agenda** : dans `BookingDetailModal`, sur un séjour futur approuvé de sa propre famille, bouton "Ajouter à mon agenda" → lien Google Calendar + fichier .ics (~2h). Joker jouable fin juin si une session se libère.
- **Checkpoint #28 (fin octobre)** : forcer un weekly réel + vérifier les logs Resend avant la saison de planification. Le système aura tourné à vide tout l'été — c'est le vrai test d'allumage.
- **Instrumentation légère** : latence d'approbation, logs d'envoi — pour décider #29 sur données, pas sur intuition.
- **Découper `stats/page.tsx` (518 l.)** — séparer fetch / agrégation / rendu. **`admin/analytics/page.tsx` (848 l.) : refonte complète** plutôt que refactor incrémental, orientée instrumentation produit.

### ❄️ Janvier 2027

- **#22b ON** : activer les rappels choix été dans le weekly, pour la famille qui doit choisir et n'a pas encore choisi. ⚠️ #22b est le **2ᵉ producteur** de la liste de « pendings actionnables » (item sept-oct) — il ne se branche pas sur #28 directement mais sur cette liste. Si elle existe et est testée d'ici là, l'activation janvier = ajouter le producteur « choix été » + bascule du flag. Sinon, pas de moteur d'envoi — à vérifier au checkpoint fin octobre.
- **Décision #29 Web Push** : GO seulement si, malgré des emails fiables, la latence d'approbation mesurée reste >48h. Sinon on n'en parle plus — valeur concentrée sur 3 chefs, et des emails fiables suffisent peut-être.

### 🤷 Un jour peut-être

- Carnet de maison / signalements — hors app pour l'instant, à revisiter si la demande émerge.
- Journal de séjour / livre d'or photos — pas convaincu, à revisiter.
- Accès invités lecture seule — si une vraie demande émerge ; coût RLS à chiffrer avant.
- #25 Page admin "Config" pour éditer les flags `lib/config.ts` via UI — quand on aura 2-3 flags. Spec `docs/specs/config-page-admin.md`.
- #30 Restructurer `/dashboard/admin` en hub — audience = 1 ; à ressortir seulement si l'admin actuel devient pénible. Spec `docs/specs/admin-hub-restructure.md` conservée.

### ⛔ Décidé skippé

- #4 Affichage visuel des overlaps dans CalendarDayCell — règle anti-overlap déjà en place côté front, fix purement défensif.
- #9 RLS placeholder été côté Supabase — pas de hackers dans la famille, RLS protège déjà les queries.
- Module charges / dépenses — on ne fait pas Tricount : autre produit, générateur de conflits.
- Flux iCal abonnement auto-sync — inutile, l'export ponctuel (bouton agenda) suffit pour 14 users.
- #23 Animations Stats (Framer Motion) — sorti de la roadmap : c'est du loisir, à faire pour le plaisir si l'envie vient, pas à planifier.

---

## 🎯 Prompts prêts à l'emploi (prochaines sessions)

> Coller tel quel en début de session. Supprimer le prompt une fois la session faite.

### Prompt 2 — Mode vacances lite (déployé avant le 22 juin)

```text
Feature : mode vacances lite (#26-lite). Deadline : déployé avant le 22 juin.
Scope volontairement minimal — la version complète (#26, APIs météo/marées/mer)
viendra cet été.

Besoin : quand un séjour est en cours à la maison, le dashboard affiche une carte
"vacances" : météo Saint-Malo, horaires des marées, température de la mer.
Version lite = liens sortants bien choisis, zéro appel API.
Les infos pratiques (wifi, manuels…) restent dans À propos — la carte lite ne porte
que météo / marées / mer.

Avant de coder :
1. Lis dashboard/page.tsx, lib/dashboard-banner.ts, lib/data/bookings.ts
   (+ ce qui te manque)
2. Présente-moi tes décisions d'archi avec reco et marqueurs de confiance :
   - condition d'affichage (séjour de MA famille en cours ? n'importe quel séjour
     en cours ? fenêtre J-2 avant arrivée ?)
   - emplacement (carte dédiée vs extension de la bannière contextuelle)
   - liens cibles exacts (météo / marées / temp. mer)
3. Attends mon GO, puis code en remplacements de fichiers complets
4. Clôture : CHANGELOG.md + docs/changelog.md (ton famille) + zip

Contrainte : zéro impact sur le flow réservation/approbation.
```

### Prompt 3 — #28 implémentation (spec déjà écrite)

```text
Chantier #28 : rapatriement & durcissement du système emails.
Spec : docs/specs/email-migration.md (déjà rédigée, prémisse corrigée par l'audit).
Audit de référence : docs/architecture/EMAIL_AUDIT.md.

La phase spec est FAITE. On passe à l'implémentation. Direction actée (ne pas la
rediscuter sans raison nouvelle) : on VERSIONNE l'existant (4 Edge Functions + triggers
+ cron dans le repo), on NE migre PAS vers des Server Actions, le déclenchement DB est
conservé. Pas de 3 modes test : preview locale à la place.

Contexte saisonnier : trafic quasi nul jusqu'en novembre. Deadline réelle : 1er
novembre. Cutover en période morte → validation synthétique, pas de trafic réel à
attendre.

Session à faire (voir §6 de la spec pour le découpage complet) — commence par la
Session 1 :
- Rapatrier les 4 Edge Functions dans supabase/functions/ (telles quelles, sous Git).
- Exporter triggers + fonctions PG + cron dans db/migrations/ (avec search_path fixé
  sur les 3 call_notify_*).
- Extraire _shared/dates.ts avec parseLocalDate → corrige le bug timezone (new Date(iso))
  dans les 4 fonctions.
- Vérifier : déploiement CI OK, un email de test s'affiche à la bonne date.

Avant de coder : lis le code réel (supabase/functions/, et ce qui te manque), confirme
l'état, signale toute divergence avec la spec. Présente tes décisions d'implémentation
avec marqueurs [Certain]/[Probable]/[Hypothèse], attends mon GO, puis remplacements de
fichiers complets + zip.

⚠️ Contraintes de séquencement (spec §3 décision B) : la suppression du filtre
last_sign_in_at vient en Session 3, APRÈS suppression des 4 comptes inactifs (sinon
spam), et après vérif des FK bookings.created_by / approvals sur ces comptes.

À glisser quand pertinent : fix erreur overlap dans ApprovalButtons.tsx (catch 23P01
+ message clair) et suppression du console.warn de CalendarDayCell.
```

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
- Comment maintenir ce fichier

---

## Comment maintenir ce fichier

À chaque session de dev importante :

1. **Pendant la session** : ajouter les items terminés dans `[Unreleased]` sous les bonnes catégories
2. **Quand on release une version** (= push notable que la famille voit) : créer une nouvelle section `[1.x.0] — date`, déplacer les items de `[Unreleased]` dedans, dater
3. **Roadmap** : déplacer les items entre horizons quand le contexte change ; un item fait passe en `[Unreleased]`, un item dont les faits changent (ex. après un audit) est réécrit sur place plutôt que dupliqué.