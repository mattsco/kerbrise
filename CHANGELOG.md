# Kerbrise — Notes de version

> Historique des versions livrées. Format inspiré de Keep a Changelog, SemVer (MAJEUR.MINEUR.PATCH).
> Pour ce qui est **à venir**, voir `ROADMAP.md`. Pour la version destinée à la famille, voir `docs/changelog.md`.

---

## [Unreleased]

> Livré depuis la v1.3.0, pas encore taggé en version famille.

### 🌸 Fonctionnalités

- **#39 — Warnings « quinzaines de juin / septembre »** (spec `docs/specs/juin-septembre-warnings.md`) : dernière règle du règlement encore purement textuelle. La famille qui occupe la **Période 1** n'est pas prioritaire sur les 14 jours qui précèdent sa période ; celle qui occupe la **Période 3** ne l'est pas sur les 14 jours qui suivent — l'enchaînement de 5 semaines que la règle vise à éviter. Non bloquant, comme #38.
  - **`lib/summer-adjacent.ts`** — logique pure et testée (**32 tests**), zéro I/O. Fenêtres **ancrées sur les dates réelles des périodes** et non sur la quinzaine calendaire : depuis le modèle pivot le début de P1 est voté chaque année, une quinzaine figée raterait la cible. « Prendre une fenêtre » = couvrir au moins une **nuit** (jours pivots autorisés, même convention qu'en #38).
  - **Gating par période attribuée**, pas sur les 3 : dès que P1 est prise, la contrainte de son détenteur est entièrement déterminée. Attendre 3/3 aurait créé un trou pile pendant la fenêtre de réservation de janvier. Seul un séjour **approved** attribue une période.
  - **Deux surfaces** : encart demandeur (`NewBookingForm`) et contexte validateur (`BookingDetailModal`), 🌷 côté juin et 🍂 côté septembre — emoji aligné aussi dans `PriorityCard`. La règle ne désignant **aucune famille prioritaire** sur ces quinzaines, la copie dit « tu n'es pas prioritaire », jamais « attends que X choisisse ».
  - `components/AdvisoryCard.tsx` extrait le shell ambre partagé avec #38 (les deux encarts restent distincts : deux règles, et ils peuvent s'afficher ensemble).
  - **Détection tolérante des périodes** : 2 des 3 périodes de l'été 2026 sont saisies à un jour des dates canoniques (P1 le 28 au lieu du 29 juin, P3 jusqu'au 30 au lieu du 31 août). Ce sont des vacances — personne n'est à un jour près, mais la contrainte s'applique quand même. `buildPeriodHolders` matche donc à **≥ 50 % des nuits** de la période (plus gros recouvrement retenu), au lieu des dates exactes. La *réservation* d'un placeholder (`getSummerSnapshot`, #22a) garde volontairement le matching exact — séparation documentée dans `docs/guides/pieges-connus.md`.
  - **Correction de régression silencieuse** : `PriorityCard` bascule sur la même détection. Ses lignes juin/septembre ne s'étaient **jamais affichées** pour 2026 depuis #22d, faute de dates canoniques exactes. Elles apparaissent enfin.
- **`docs/guides/pieges-connus.md`** (nouveau, lié depuis le README) : recueil des pièges invisibles à la lecture du code — l'espace JSX perdu entre une expression et le texte suivant, les deux matchings de périodes d'été volontairement différents, et le fait que `DEV_LOGIN_BYPASS` ne donne aucune session Supabase au **navigateur** (toute requête client revient vide en dev local, sans erreur).
- **#38 — Warnings « ponts de mai »** (spec `docs/specs/ponts-printemps-warnings.md`) : rend visible, sans jamais bloquer, la règle « la famille en priorité 3 l'été est prioritaire sur les ponts de mai de la même année » (compensation de l'été subi).
  - **`lib/ponts.ts`** — logique pure et testée (**27 tests**, esprit #34), zéro I/O. Modélise les ponts de mai (1er/8 Mai, Ascension, Pentecôte ; Pâques exclu) : fenêtre calculée selon le jour de semaine du férié (jeu→dim, ven→dim, sam→lun, sam→mar ; mer/we = pas de pont), fusion des fenêtres qui se chevauchent, « prendre un pont » = couvrir au moins une **nuit** (jours pivots autorisés). `getPontPriorityFamily(year)` est la règle à un seul endroit, désormais aussi consommée par `PriorityCard`.
  - **Warnings demandeur** (`NewBookingForm`, encart ambre non bloquant) : cas A (pas prioritaire, la prioritaire n'a pas encore choisi — s'éteint dès qu'elle a un pont **approved**, une demande *pending* est mentionnée), cas B (2ᵉ pont alors qu'une famille n'en a aucun), cas C (info positive si tu es prioritaire). Cumulables.
  - **Contexte validateur** (`BookingDetailModal`) : sur une demande *pending* couvrant un pont, encart factuel (famille prioritaire, ponts déjà pris) — aucune reco d'accepter/refuser.
  - Règlement (`a-propos/regles`) reformulé : « pont de la **même année** » au lieu de l'ambigu « printemps suivant ».
  - Snapshot DB (`lib/ponts-state.ts` + 1 requête dans `lib/data/bookings.ts`) : seul un séjour **approved** compte comme « pont pris » ; *pending* affiché à titre informatif. Aucun email (v1).

### 🧪 Qualité & outillage

- **#34 — Tests sur `lib/` + CI minimale** (spec `docs/specs/tests-ci-lib.md`) :
  - **Vitest** en devDep unique, tests colocalisés `lib/*.test.ts` — **108 tests, ~0,5 s**, scripts `npm test` / `npm run test:watch` (forcés en `TZ=Europe/Paris`, le fuseau de l'app). P0 : rotation été ancrée 2024 (table de vérité 2024–2030), bornes exactes P1/P2/P3 en **legacy 2026 ET pivot 2027+** (chevauchement au jour pivot, années non votées qui lèvent), `overlapsSummerPeriod`, bascule `getRelevantSummerYear` au 1ᵉʳ octobre figée par test, placeholders été (tour de rôle par priorité). P1 : verrou du **bug timezone historique** (`parseLocalDate` minuit local — le test échoue si on le remplace par `new Date(iso)`), helpers de dates clippées, longueurs de mois **exactes** des coefs de marée (bissextiles comprises — garde-fous dev promus en assertions), paliers `tideLevel`, intégrité des 365 jours d'horaires 2026 (croissance des heures, coef sur chaque PM, `getOfflineTides` au 31 décembre). P2 : `db-errors`, `validation/booking`, `families` (ordre de rotation verrouillé), `holidays`, `garbage-collection`.
  - **CI GitHub Actions** (`.github/workflows/ci.yml`) : `tsc --noEmit` + lint + tests à chaque push/PR, Node 22, pas de secrets, pas de build Next (Vercel s'en charge).
  - **`npm run lint` réparé** (cassé depuis Next 16, cf. note #35) : ESLint 9 flat config avec les presets officiels Next (`eslint.config.mjs`), `react/no-unescaped-entities` coupée (app en français), règles sur code préexistant (`no-explicit-any`, `ban-ts-comment`, react-hooks v7) en **warning** — 0 erreur, baseline à resserrer. Au passage : `prefer-const` auto-fixés, `require()` → import dans `tailwind.config.ts`, directives `eslint-disable` obsolètes retirées.
  - 🐛 **Bug réel débusqué par les tests** : `lib/holidays.ts` raccourcissait les noms de fériés via une table qui ne matchait pas les noms réellement renvoyés par `date-holidays` (5 fériés sur 11 : « Fête Nationale de la France », « Armistice 1918 », « Nouvel An »…) → l'UI affichait les noms longs au lieu de « 14 Juillet », « 11 Novembre »… Table corrigée, mapping des 11 fériés verrouillé par test.
  - Badge CI ajouté au README.

### 🔐 Auth, sécurité & perf

- **#35 — Hygiène dépendances + suppression de la route morte `/api/tides`** :
  - **Route morte supprimée** : `app/api/tides/route.ts` (endpoint public non authentifié) n'appelait que le scraper `lib/maree-info.ts`, lui-même bloqué en prod (maree.info renvoie 403 aux IP datacenter Vercel) et **plus consommé par aucun code** depuis le passage des marées en offline (#26). Suppression de la route **et** de `lib/maree-info.ts` (les deux exports `fetchSaintMaloTides` / `getSaintMaloTidesSafe` étaient orphelins) — 174 lignes de code mort et une surface publique inutile en moins.
  - **`cheerio` retiré** des dépendances : la lib de scraping n'existait que pour `maree-info.ts`. Devenue orpheline, retrait ⇒ **24 packages en moins** (cheerio + son arbre), `package-lock.json` allégé de ~350 lignes nettes.
  - **Vuln postcss (2× modérées, GHSA-qx2v-qp2m-jg93) éliminée** : `npm audit` remontait un postcss < 8.5.10 **bundlé par Next** (`node_modules/next/node_modules/postcss@8.4.31`). ⚠️ Découverte à la revue : **le bump de Next ne suffit pas** — la dernière stable `16.2.10` épingle *encore* `postcss@8.4.31` en dépendance directe exacte, donc aucun patch Next 16.2.x ne corrige la vuln. Résolu via **`overrides: { "postcss": "$postcss" }`** (référence la devDep directe, plancher relevé à `^8.5.10`), ce qui déduplique la copie imbriquée de Next sur le top-level `8.5.14`. Next quand même bumpé `16.2.9 → 16.2.10` (patch, hygiène). **`npm audit` : 0 vuln.** Validé par `npm run build` OK (pipeline CSS de Next intact malgré l'override 8.4→8.5, minor rétro-compatible) + `tsc --noEmit` propre.
  - *Note hors #35, à traiter en #34 (CI/lint)* : `npm run lint` (`next lint`) est cassé — Next 16 a **retiré la sous-commande `next lint`** ; `next` interprète `lint` comme un dossier (« Invalid project directory »). Pré-existant, indépendant de ce changement.
- **#36 — Ménage repo** (chore, aucun impact comportement) :
  - `SESSION_2026-06-25.md` déplacé de la racine vers `docs/` (`git mv`, historique préservé) — note de session DB dont le fond est déjà dans ce CHANGELOG, gardée comme archive brute.
  - Zips locaux redondants supprimés : `docs/audit.zip` et `docs/audit/05-edge-functions.zip` doublonnaient **à l'identique** (tailles vérifiées) leur contenu déjà extrait dans `docs/audit/`. Fichiers **non suivis par git** (gitignorés) → suppression purement locale, sans impact repo.
  - `.gitignore` nettoyé : ligne malformée `.DS_Storedocs/audit/` (newline manquant) et règles en double (`docs/audit.zip` ×2, `.DS_Store` ×2, `docs/audit/` redondant) réduites aux règles effectives (`*.zip` + `docs/audit/` couvrent tout). Comportement d'ignore identique, vérifié via `git check-ignore`.
  - ⚠️ **Deux prédictions de la roadmap infirmées à l'exécution** : `next-env.d.ts` n'avait plus aucun diff (régénéré à l'identique par le build de #35, rien à restaurer) ; `package-lock.json` est modifié **par #35** (retrait cheerio + override postcss), donc à **committer avec #35**, surtout pas à restaurer.
- **Vérification JWT locale via signing keys ES256 (`getClaims`)** : le middleware appelait `supabase.auth.getUser()` sur **chaque** requête — un round-trip réseau vers le serveur Auth pour valider le token. Mesuré en prod (`lhr1` → Supabase `eu-west-1`) : **~40 ms médians, pics à 150 ms, cold start à 577 ms**. En parallèle, `lib/supabase/auth.ts` lisait la session côté pages via `getSession()`, qui décode le cookie **sans vérifier la signature** → warnings « insecure » de Supabase à chaque page authentifiée. Migration des deux vers **`getClaims()`** : vérification cryptographique de la signature **en local** via la clé publique ES256 (Web Crypto, JWKS en cache mémoire 10 min), sans contacter Auth. Résultat mesuré sur preview : **médiane ~5 ms (~8×), indépendante de la région** (vérif locale, plus de sensibilité à la distance Supabase) ; warnings insecure supprimés (on vérifie au lieu de faire confiance aveuglément).
- **Refresh de session préservé** : `getClaims()` sans argument appelle `getSession()` en interne (vérifié dans la source de `auth-js`), qui rafraîchit le token expiré et déclenche le `setAll` des cookies du middleware. Le renouvellement de session est donc intact — validé sur **>12 h sans déconnexion**. C'était le seul vrai risque de la bascule.
- **Filet de sécurité** : si le token était signé en HS256 (symétrique) ou si WebCrypto était indisponible, `getClaims()` retombe automatiquement sur `getUser()` (réseau). Jamais cassé, au pire aussi lent qu'avant.
- **Coût résiduel assumé** : un fetch JWKS unique (~450 ms) au démarrage d'une instance Edge froide, puis cache mémoire → toutes les requêtes suivantes à ~5 ms. On échange « 40 ms à chaque requête » contre « ~450 ms une fois par instance froide / 10 min ». Largement gagnant pour le trafic familial.
- **Aucun bump de dépendance** : `@supabase/supabase-js` était déjà résolu en `2.108.1` (`getClaims` + vérif JWKS présents) ; `@supabase/ssr` 0.5.2 conservé. La clé ES256 était déjà « in use » sur le projet Supabase (confirmé par `alg=ES256` dans les logs), pas de rotation nécessaire. Migration validée sur la branche `feat/jwt-signing-keys` via instrumentation temporaire (retirée avant merge).

### 🗄️ Base de données & data layer

- **Schéma mis sous version (clôture §3.4 du review)** : les tables, fonctions, triggers et policies ne vivaient plus que dans le dashboard Supabase. Ajout de `db/migrations/0000_baseline.sql` — snapshot de référence des **7 tables, 16 fonctions, 11 triggers et 21 policies RLS** (dump via `pg_get_functiondef` / `pg_get_triggerdef` / `pg_policies`, pas à la main : le « 6 fonctions » estimé en oubliait 10, surtout les `call_notify_*` email). ⚠️ Trace de référence, **non rejouée sur la prod** (CREATE TABLE/POLICY sans `IF NOT EXISTS`) ; rejouable seulement sur un env vierge via la séquence `0000 → 0010`. Les `CREATE TABLE` excluent volontairement les 2 contraintes ajoutées par 0007/0008 pour éviter la collision au replay.
- **`0007` — anti-double-vote** : `UNIQUE (booking_id, family_id)` sur `approvals` + `update_booking_status_after_approval` passé en `count(distinct family_id)`. Avant, une même famille pouvait voter « approved » plusieurs fois et forcer seule l'approbation (la règle exige 2 familles sur 3).
- **`0008` — anti-chevauchement atomique** : contrainte `EXCLUDE USING gist` sur les séjours `approved`. Le trigger procédural `check_booking_overlap` faisait SELECT-puis-INSERT sans verrou → deux insertions concurrentes passaient. La contrainte EXCLUDE sérialise réellement au niveau base. Périmètre `approved` uniquement (plusieurs familles peuvent demander la même semaine d'été, départagées ensuite).
- **`0009`** : `WITH CHECK` manquant sur la policy UPDATE admin de `feature_requests` (un admin pouvait réassigner `user_id` à quelqu'un d'autre).
- **`0010`** : drop des **2 contraintes en double** présentes en prod (une `UNIQUE` orpheline sur `approvals`, une `EXCLUDE` préexistante sur `bookings`), héritage hors-repo. On garde celles nommées par les migrations.
- **Gestion d'erreurs UI (`lib/db-errors.ts`)** : 0007/0008 font remonter des violations Postgres brutes. Traduction de `23505` (unique) / `23P01` (exclusion) en messages FR **par code SQLSTATE**, pas par regex sur le message (robuste aux versions PG et à la locale). Câblé dans `ApprovalButtons` (approuver + refuser) et les server actions `admin/actions` (création/édition admin) et `calendrier/actions` (réservation prioritaire). Avant, l'utilisateur voyait une stack technique anglaise.
- **Refacto data layer bookings** : 5 pages requêtaient `bookings` en inline avec leur propre select et fallback `?? "?"`. Centralisé dans `lib/data/bookings.ts` (`getUpcomingApprovedBookings`, `getApprovedBookingsOverlappingRange`, `getSummerBookings`, `getPendingBookingsAwaitingFamily`) : un renommage de colonne = une seule édition. Les sémantiques **divergentes** (chevauchement d'année pour les stats vs inclusion dans l'été pour les priorités) sont gardées distinctes, pas fusionnées — les confondre aurait été un bug.
- **chore** : suppression de `public/logo.png` (430 ko, doublon non référencé d'`icon-512`, jamais servi) ; commentaires timezone obsolètes corrigés (le bug `new Date(iso)` de `demandes/page.tsx` était déjà résolu via `parseLocalDate`).

### 🕵🏻 Admin

- **#30 — Restructure du hub Admin (sorti de la roadmap)** : `/dashboard/admin` redevient un **vrai hub léger** (stats rapides + 6 cartes Health / Analytics / Locations / **Lab** / **Data** / Product) au lieu d'un placard fourre-tout. Deux nouvelles sous-pages :
  - **`/admin/lab`** : outils de simulation déplacés ici (toggle chef de famille, toggle mode admin calendrier, simuler approbation François/Vincent) + section « Mode email ». Les server actions redirigent désormais vers `/admin/lab` pour y afficher le feedback.
  - **`/admin/data`** : `AdminBookingForm` (création de séjour mode admin, sans email), gardé derrière `is_calendar_admin`. Réservé aux futures opérations data (imports, resets, exports).
  - Liens externes (Supabase, Vercel, Resend, Edge Functions) passés en **footer discret** au lieu d'une grosse section. Composant `AdminFeedbackBanner` mutualisé. Spec `docs/specs/admin-hub-restructure.md` (✅).
- **Page Product (`/admin/feature-requests`) — Roadmap & Changelog** : un toggle à deux onglets affiche désormais **les deux** docs (`ROADMAP.md` = à faire, `CHANGELOG.md` = livré). Avant, seul le changelog s'affichait, sous un titre « Roadmap » trompeur. Composant `RoadmapChangelogTabs`.
- **Page Health durcie** :
  - Ne **crashe plus** si `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` manque : un guard pousse un check `fail` explicite au lieu de lever une exception (`createServerClient` qui plantait toute la page). Une page de diagnostic doit survivre à la panne qu'elle détecte.
  - Checks `pg_cron` / `triggers` / `vault` qui tombaient en permanence sur `warn` « non vérifiable » (ils interrogeaient les schémas internes `cron` / `information_schema` / `vault` via PostgREST, qui n'expose que `public`) → désormais via **RPC `public` SECURITY DEFINER** (`db/migrations/0006_health_checks.sql` : `health_cron_job`, `health_triggers`, `health_vault_secret`). Tant que la migration n'est pas appliquée, ils s'affichent en nouveau statut **`skip`** (neutre, gris) au lieu de polluer la bannière warnings.

### 📊 Stats

- **#23 — Animations Stats (sorti de « décidé skippé »)** : compteurs qui montent (easeOutCubic) sur le taux d'occupation et le printemps-été ; barre de répartition famille et 12 barres mensuelles qui poussent de 0 à leur largeur, les mois **en cascade** (45 ms/mois) ; rejoue au changement d'année ; respecte `prefers-reduced-motion`. **Fait sans Framer Motion** : CSS + petit composant client (`StatsClient.tsx`, ~1 ko) plutôt qu'une dépendance ~40  ko, pour ne pas alourdir une page jusque-là 100 % server-rendered.

### 🏠 À propos & maison

- **Refonte de la page À propos** : figée en **lecture seule** (suppression de l'édition en ligne intro/liens/contacts), réordonnée (Règles, Freebox, Télé, Poubelles, Liens & contacts), liens/contacts en dur (Compta, Ancien calendrier, Taxi ABC, Phytomer), poubelles toujours visibles.
- **Nouvelle page `/a-propos/tele`** : guide de la télé Philips 40PFS6050 (télécommande unique à boutons 3D + touche 123, app Freebox TV vs Free TV, comportement extinction, retour Freebox via HDMI 1), photo + vidéo démo compressée. Lisibilité soignée : encart « l'essentiel en 3 points », pièges en alertes ambre.
- **Carte statut Freebox** sur À propos : route `/api/maison-status` (check `/api_version` non authentifié via `FREEBOX_API_BASE`, timeout 5 s, cache 60 s, pas de ping ICMP), bouton mot de passe wifi déplacé dedans. Le champ **`reason`** distingue les causes d'échec (`no-env` / `timeout` / `dns` / `tls` / `http-<code>` / `no-api-version` / `fetch-error`) au lieu d'un `online:false` opaque indébogable. ⚠️ Le port HTTPS direct n'est ouvert que si « Activer l'auth par mdp » est coché dans Freebox OS.

### 🌊 Conditions

- **Retrait de l'affichage temp. mer** (bannière dashboard + écran e-ink du salon) : la moyenne saisonnière statique était trop loin du réel et sans intérêt pour les users. Couche données (`lib/sea-temp.ts`) laissée en place — coût nul, réversible.

### 📺 TRMNL salon

- Vue salon : « MAJ {{ generated_at_label }} » dans le title bar + **coucher de soleil** en bas à droite (repli propre si météo `null`). Guide TRMNL enrichi d'une section Refresh Rate (device vs plugin, modèle on-demand, runbook debug).

### ⌚ Garmin

- Premiers travaux d'app **Garmin Connect IQ** (widget marées Kerbrise) — cf. `docs/guides/garmin-app-guide.md`.

---

## [1.3.0] — 16 juin 2026

### ✨ Ajouts
- **#26 — Conditions du jour dans la bannière** : quand un séjour est en cours (cas A/B), la bannière contextuelle du dashboard s'enrichit de lignes « conditions », **dans son propre style** (pas de widget) : icônes d'accent, valeurs en gras, labels atténués, coef en pastille douce. Contenu :
  - **marées** : les 2 prochaines à venir (heure + pleine/basse, flèches ↑/↓), calculées par rapport à l'heure de Paris (débordent sur demain en fin de journée), avec le **coef** en pastille (statique). Source **offline** (cf. « Horaires de marée offline » plus bas) ; repli `Marée du jour` + coef seul si la date n'est pas couverte.
  - **température de l'eau** : valeur seule (sans label, l'icône goutte suffit).
  - **météo du jour** : min / max + **écart de la moyenne du jour vs la normale du mois** (« +2° vs la normale », table climato statique Saint-Malo — base stable, pas la veille qui est une valeur de grille volatile), et **coucher du soleil** aligné à droite.
  - **tendance de la semaine** : une phrase au ton léger générée par règles déterministes sur les 7 prochains jours (ex. « Grand beau et chaud toute la semaine, tu as de la chance »). Pas de LLM, pas d'invention.
  - Sources : **temp. eau** = **moyenne saisonnière statique** du mois (`lib/sea-temp.ts`, table 12 valeurs façon `tides.ts`), affichée « mer ~14° en juin » ; **marées** (heures) = **table annuelle committée offline** (`lib/tides-times.ts`) ; **météo** = Open-Meteo Forecast (min/max, écart vs la normale du mois, coucher du soleil, tendance 7j) ; **coef** = statique `lib/tides.ts`. Seul Open-Meteo reste une dépendance réseau au runtime (non bloquée sur IP datacenter).
    - *Pourquoi la temp. eau est saisonnière et non « du jour »* : toutes les API marines testées surestiment fortement (Open-Meteo ~19°, Stormglass ~18° vs ~13° réels — modèles à maille large qui ne résolvent pas l'eau côtière froide), et les sources mesurées précises (cabaigne, letelegramme, lachainemeteo) sont derrière Cloudflare → **403 depuis une IP datacenter** (Vercel), problème partagé par toute automatisation serveur. La moyenne mensuelle committée donne le bon ordre de grandeur, stable, sans dépendance ni quota.
  - Fetch **côté serveur**, sous `<Suspense fallback={null}>`, Open-Meteo **caché** 2h, **timeout** (4-5s), **mode dégradé** ligne par ligne. Marées et temp. eau étant désormais offline, il n'y a plus de maillon scrapé fragile dans cette surface.
  - **Durcissement de l'existant** : `lib/maree-info.ts` (scraper cheerio préexistant, jamais branché) corrigé — bug de type `waterTemperature` (renvoyait la chaîne `"undefined"`, **seule erreur de compil du projet**), `no-store` → cache 3h, timeout + wrapper non-throwing `getSaintMaloTidesSafe`.
  - Nouveau `lib/conditions.ts` + composant `app/dashboard/BannerConditions.tsx` (rendu dans `ContextualBanner`).
  - **Scope coupé** : pas de recommandations d'événements (aucune source fiable — à ne ré-ouvrir qu'en curation admin manuelle). Cf. ROADMAP.
- **Endpoint `GET /api/term`** (TRMNL) : payload JSON avec **séjour** (`stay` : famille, dates, jours restants, `Jour x/y` ; `next` : prochaine arrivée + phrase de relais + pivot) et **conditions #26** (marées du jour + coef, mer saisonnière, météo + écart vs hier + coucher du soleil + tendance semaine). Labels pré-formatés (le template Liquid n'affiche), date `Europe/Paris` (`todayInParis()` ajouté à `lib/dates.ts`), route `force-dynamic`, blocs `null` si source en panne.
  - 🔒 **Protégé par token** `Authorization: Bearer ${TRMNL_API_TOKEN}` : le bloc séjour expose la présence/absence de la famille (cf. spec §9). Lecture bookings via **service role** Supabase (`lib/supabase/service.ts`, `server-only` — 1ʳᵉ introduction de la service key) + `lib/data/sejour.ts`. Env requises : `TRMNL_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.
  - ✅ **Heures de marée en prod — résolu** : le scraper `maree.info` rendait `high_label`/`low_label` à `null` en prod (IP datacenter Vercel bloquée). Remplacé par la table annuelle committée offline (cf. ci-dessous) ; `/api/term` et la bannière affichent désormais les horaires en prod.
  - Reste de la spec à faire : WiFi/QR, poubelles, switch d'écrans (`/api/trmnl/screen`).
- **🌊 Horaires de marée committés offline (option 2)** : les heures PM/BM + hauteurs de Saint-Malo suivent désormais le pattern des coefs (`lib/tides.ts`) — donnée déterministe committée, **zéro scrape au runtime**. Motivation : `maree.info` bloque les IP datacenter (OK en local, vide en prod), et un cron serveur taperait dans le même mur.
  - Données : `lib/data/tides-times-2026.ts` (généré, 365 jours, clé = date ISO, events PM/BM + hauteur + coef). Loader `lib/tides-times.ts` (`getTideTimesDay`, `getOfflineTides` → forme compatible avec l'ancien scraper, aujourd'hui + lendemain) + garde-fou dev. `lib/conditions.ts` lit l'offline (synchrone), n'importe plus `lib/maree-info.ts`.
  - Source : office de tourisme de Saint-Malo, récupéré 1×/an (pas `maree.info`, dont les CGU interdisent l'extraction). Générateur reproductible `scripts/tides/generate.py` + dump source versionnés.
  - **Validation** : les 705 coefficients de pleine mer extraits == `RAW_BY_YEAR[2026]` de `lib/tides.ts` en séquence chronologique exacte (les deux sources concordent), preuve d'intégrité de toute la table (heures, hauteurs, jours). `TideTimeEvent.height` est `number | null` (la source omet parfois une hauteur).
  - Rappel annuel programmé pour générer 2027 en décembre. Reste : `app/api/tides/route.ts` (orphelin, sans consommateur) scrape encore en live — à supprimer ou rebrancher.

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
