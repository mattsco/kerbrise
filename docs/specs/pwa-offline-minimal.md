# Spec — Offline PWA minimal (#37)

> **Statut** : 📋 Périmètre tranché (20 juillet 2026) — **attend son déclencheur** (cf. plus bas)
> **Type** : Feature / résilience
> **Cible** : un jour peut-être — à ne faire que si le déclencheur sonne
> **Estimation** : ~2 j (service worker + page offline + snapshot calendrier)
> **Dernière MAJ** : 20 juillet 2026

## Problème

Kerbrise est une PWA **installée** sur les téléphones de la famille… sans service worker : `public/manifest.json` existe, mais si le réseau tombe, l'app installée affiche l'écran d'erreur navigateur. Or le produit **acte lui-même** que le réseau de la maison est faillible : carte statut Freebox sur À propos, projet RPi de monitoring wifi (#14 évolué).

L'ironie : c'est précisément **quand le wifi de la maison est mort** qu'on a besoin des infos pratiques — et l'app qui les contient devient inaccessible au même moment. Les données les plus utiles hors ligne (marées du jour, coefs, rotation été) sont pourtant **déjà committées dans le bundle** — l'offline est presque gratuit côté données.

## Périmètre (tranché, 20 juillet 2026)

**Pas** d'offline générique de toute l'app. Deux natures de contenu, deux mécanismes :

### 1. Contenu recalculable en pur — rendu client, précaché

Un **service worker** léger précache `/hors-ligne` (+ assets), servie en fallback de navigation quand le fetch réseau échoue. Contenu rendu **côté client** depuis le code pur committé (zéro Supabase) :

- **Marées du jour** : horaires + coefs depuis les tables committées (`lib/tides.ts`, `lib/tides-times.ts`).
- **Poubelles** : prochaines collectes (`lib/garbage-collection.ts`, pure).
- **Règles de la maison / rotation été** : le contenu de `a-propos/regles` est presque entièrement dérivable de `lib/summer-priorities.ts` (`getYearPriorities`, `getPeriodDates`, `SUMMER_PERIODS` — pur, et le code le plus testé du repo depuis #34). Le seul bout personnalisé (« ta famille ») vient du snapshot ci-dessous.
- **Infos pratiques d'À propos** : numéros/liens utiles, adresses, consignes (statiques). La carte Freebox tombe à vide hors ligne — cohérent, elle mesure le réseau.
- **Mot de passe wifi** : **inclus** (décision du 20 juillet 2026, cf. décisions actées).

⚠️ Les pages serveur existantes (`a-propos`, `regles`) ne sont PAS précachées telles quelles : elles sont `force-dynamic`, derrière l'auth, rendues par utilisateur — précacher leur HTML serait exactement le piège « SW qui sert du périmé ». On re-rend leur **contenu** côté client dans la surface offline.

### 2. Calendrier — snapshot LECTURE SEULE, fenêtre glissante M−3 → M+12

- Quand l'app est ouverte **en ligne**, un hook client stocke le JSON des séjours sur une **fenêtre glissante de M−3 à M+12** (3 mois en arrière pour le contexte récent, 12 mois en avant pour couvrir la saison de planification), avec un timestamp. Quelques Ko.
- Hors ligne : rendu lecture seule avec bandeau bien visible **« Dernière synchro : {date} »**. Aucune action possible (pas de demande, pas de vote).
- Les 3 périodes d'été + attribution par priorité se recalculent en pur même sans snapshot ; seuls les séjours réels en dépendent.
- Le snapshot est **applicatif** (stockage local géré par l'app), jamais un cache HTTP de réponses Supabase dans le SW.

## Décisions actées (20 juillet 2026)

1. **Mot de passe wifi : inclus dans le contenu offline.** Donc stocké en clair dans le cache du navigateur, hors auth. Choix de sécurité explicite : appareils familiaux, risque faible, et le mdp est de toute façon écrit sur la box. Conséquence directe sur la question auth ci-dessous.
2. **Données famille dans le stockage local, hors auth** (snapshot séjours + nom de famille de l'utilisateur) : accepté. Des dates de séjours — moins sensible que le mdp wifi, même logique d'appareils familiaux.
3. **Fraîcheur du calendrier** : le vrai risque produit est un calendrier périmé qui laisse croire qu'une période est libre. Mitigation actée : bandeau de date de synchro + lecture seule stricte. Pas de sync en arrière-plan.
4. **Fenêtre calendrier : M−3 → M+12 glissants** (et non année civile N/N+1).
5. **UX hors ligne : surface dédiée, PAS le vrai dashboard grisé** (20 juillet 2026). Le dashboard est une page serveur `force-dynamic` : hors ligne, il n'existe pas — le montrer « avec des sections désactivées » exigerait de le convertir en app shell client précaché, une réarchitecture de la home qui multiplie le risque d'invalidation SW. À la place :
   - Toute navigation hors ligne (y compris l'ouverture de la PWA sur `/dashboard`) → le SW sert `/hors-ligne`.
   - `/hors-ligne` reprend **la grammaire visuelle du dashboard** (mêmes cartes, même ordre) pour ne pas dépayser : bandeau « Hors ligne — dernière synchro {date} » en tête, puis marées, poubelles, calendrier snapshot, règles/rotation, infos pratiques, mdp wifi.
   - Les sections impossibles offline (webcam, demandes/votes, stats, statut Freebox) apparaissent en **ligne grisée « indisponible hors ligne »** plutôt que de disparaître silencieusement — on explique, on ne laisse pas croire à un bug.
   - **Aucun lien vers les vraies pages de l'app** (elles échoueraient) : la surface offline est autosuffisante. Réseau revenu = navigation normale, le fallback n'est jamais servi quand le fetch réussit.

## Plan d'implémentation (5 étapes, chacune livrable seule)

> Découpage acté le 20 juillet 2026. Principe : l'étape risquée (cycle de vie du SW) en PREMIER, isolée sur un contenu trivial — pas à la fin quand tout le contenu en dépend.

1. **Service worker + squelette `/hors-ligne`.** SW à la main (< 100 lignes) avec la **stratégie d'invalidation dès le premier jour** : cache versionné par build (`BUILD_ID`), nettoyage des vieux caches à l'activation. Enregistrement **post-login uniquement** (composant client dans le layout dashboard — tranche la question auth vs précache). Page `/hors-ligne` minimale : bandeau « Hors ligne », rien d'autre. Test : DevTools offline → fallback servi ; redéploiement → ancienne version évincée.
2. **Cartes pures.** Marées du jour + coef, poubelles, règles/rotation été — importés de `lib/` (pur, testé par #34), calculés côté client. Mesurer le poids des tables marées dans le bundle client (~50-100 Ko attendus). La page prend la grammaire visuelle du dashboard.
3. **Snapshot applicatif.** Hook client qui, à chaque ouverture EN LIGNE du dashboard, stocke en localStorage : séjours M−3 → M+12, nom de famille de l'utilisateur, timestamp. La page offline rend le calendrier lecture seule + « ta famille », avec « Dernière synchro : {date} ». Dégradation propre sans snapshot (absent ou évincé iOS) : les cartes pures restent, le calendrier dit « pas encore de synchro ».
4. **Contenu statique complet.** Infos pratiques, numéros utiles, mdp wifi (déplacer la constante de `MaisonStatus.tsx` vers `lib/config.ts` au passage), lignes grisées « indisponible hors ligne » (webcam, demandes, stats, Freebox).
5. **Durcissement + réel.** Tests Vitest sur les helpers purs ajoutés (infra #34), test sur un vrai iPhone (installation PWA, mode avion, éviction), vérif du flux de mise à jour du SW, docs (CHANGELOG, spec → implémentée).

**Constat qui dé-risque la décision n°1 (mdp wifi)** : le mot de passe est DÉJÀ une constante en dur dans un composant client (`app/dashboard/a-propos/MaisonStatus.tsx`) — il est donc déjà présent en clair dans le bundle JS téléchargé par tout navigateur authentifié. L'inclure dans la page offline ne dégrade pas la posture de sécurité existante.

## Questions encore ouvertes (à trancher à l'implémentation)

1. **Auth vs précache.** Le mdp wifi étant inclus, `/hors-ligne` contient de la donnée sensible → soit servie hors middleware auth (simple, mais la page est publique pour qui a l'URL), soit précachée **post-login seulement** (le SW ne s'installe qu'une fois authentifié). La deuxième est cohérente avec le contenu retenu ; à valider en implémentant.
2. **Fraîcheur du SW.** Un service worker mal invalidé qui sert une vieille version est pire que pas de SW (bugs fantômes impossibles à diagnostiquer à distance pour une famille non technique). Stratégie de mise à jour à définir (skipWaiting + reload prompt ? cache versionné par build ?). C'est LE risque du chantier — la raison de ne pas le faire « vite fait ».
3. **iOS.** La majorité de la famille est probablement sur iPhone : vérifier le comportement PWA + SW sur Safari iOS (support correct depuis 16.4, mais éviction de cache agressive — le fallback ET le snapshot doivent survivre… ou échouer proprement : c'est du best-effort, pas une garantie).
4. **Poids client des tables marées.** Embarquer `tides-times` + coefs dans le bundle client de `/hors-ligne` (~50-100 Ko de données annuelles) + calcul « aujourd'hui » en client. Faisable, à chiffrer au moment venu.

## Signal de déclenchement (inchangé)

Ne pas construire sur hypothèse. Déclencheurs légitimes :
- quelqu'un de la famille se plaint *en vrai* d'avoir eu besoin d'une info app pendant une panne wifi/4G à la maison ;
- ou le monitoring RPi (#14) montre des coupures fréquentes.

Sinon, ça reste un joli chantier technique sans demande — exactement ce que la roadmap sait dire non.

## Hors périmètre (définitif)

- **Toute action hors ligne** : demandes, votes, approbations — flux transactionnels, network-only. Le calendrier offline est un snapshot lecture seule, pas un mode dégradé de l'app.
- **Cache HTTP de réponses Supabase dans le SW** — le snapshot calendrier est applicatif et explicite, jamais un cache réseau implicite.
- Background sync / notifications push (c'est #29, décision séparée).
- Workbox ou toute dépendance : si ça se fait, c'est un SW écrit à la main de < 100 lignes, dans l'esprit « ~1 Ko de CSS plutôt que 40 Ko de lib » du projet.
