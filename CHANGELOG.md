# Kerbrise — Journal de développement

Format inspiré de [Keep a Changelog](https://keepachangelog.com/).
Versionning [SemVer](https://semver.org/) : MAJEUR.MINEUR.PATCH.

---

## [Unreleased] — en cours pour la 1.2.0

### À faire — prioritaire
- **#24** Release notes côté users (footer "Quoi de neuf" dans À propos) — *en cours, ce qu'on fait là*
- **#27** Migrer `app/dashboard/admin/actions.ts` vers `requireAuthUser` — *cleanup rapide, gain ~100ms par action admin*
- **#22d** Priority card explicative dans Profil — *vraie card avec implications de la priorité de l'année (ponts, juin/septembre…)*

### À faire — features visibles
- **#26** Mode "vacances" sur la home avec météo Saint-Malo, température mer, marées — *l'app devient app de vacances quand on est sur place*
- **#22b** Notifications email pour les choix de période d'été — *bloqué tant que #28 pas fait, prévu pour janvier 2027 (prochain cycle)*

### À faire — refactor / dette tech
- **#18** Migrer les `<img>` restants vers `next/image` — *impact marginal après la compression manuelle, mais propre*
- **#23** Animations Stats avec interpolation Framer Motion — *side-project sympa quand t'as 1-2h*

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
- **#25** Page admin "Config" pour éditer les flags `lib/config.ts` via UI (quand on aura 2-3 flags)

### Décidé skippé
- **#4** Affichage visuel des overlaps dans CalendarDayCell — *règle anti-overlap déjà en place côté front, fix purement défensif*
- **#9** RLS placeholder été côté Supabase — *pas de hackers dans la famille, RLS protège déjà les queries*

---

## [1.1.0] — TODO (à dater quand on release)

> Grosse session de polish, perf et refonte mineure du flow été.

### ✨ Ajouts
- Permissions sur le choix des périodes d'été : seul le chef de famille peut picker (flag `SUMMER_CHOICE_FREEDOM` dans `lib/config.ts` pour ouvrir à tous les membres si besoin un jour)
- Auto-assignment automatique de la priorité 3 quand les 2 autres familles ont choisi
- Vercel Speed Insights branché pour mesurer les perfs réelles
- Section "Quoi de neuf" en bas de À propos (#24)

### ⚡ Améliorations perf
- Navigation back instantanée (`router.back()` + cache mémoire au lieu de refetch)
- Dashboard parallélisé (auth + profile + bookings en parallèle) → ~50-80ms gagnés
- Stats parallélisée → ~50ms gagnés
- Migration auth vers `requireAuthUser` (lecture cookie locale) → ~80-150ms gagnés par navigation
- Plus de polling 60s pour la collecte des ordures (timeout jusqu'à minuit)
- Memo + useCallback sur CalendarDayCell (90 cellules, plus de re-render inutile)
- Middleware : `event.waitUntil` au lieu de fire-and-forget

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

### 🐛 Bug fixes
- **#1** Icon PWA manquant : `/icon-192.png` → `/icon-196.png` dans `app/layout.tsx`
- **#2** Bug timezone dans `a-propos/page.tsx` : `today.toISOString().slice(0,10)` après `setHours(0,0,0,0)` retournait toujours la veille en hiver Paris
- **#3** Bug timezone dans `dashboard/page.tsx` : faux entre minuit et 1-2h Paris
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
   - 🐛 Bug fixes
   - ⚠️ Breaking changes : si jamais on casse un comportement existant