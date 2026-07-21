# Spec — Offline PWA minimal (#37)

> **Statut** : 📋 Périmètre **et** implémentation tranchés (21 juillet 2026) — **attend son déclencheur** (cf. plus bas)
> **Type** : Feature / résilience
> **Cible** : un jour peut-être — à ne faire que si le déclencheur sonne
> **Estimation** : ~2 j (service worker + page offline + snapshot calendrier)
> **Dernière MAJ** : 21 juillet 2026

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

1. **Service worker + squelette `/hors-ligne`.** SW à la main (< 100 lignes) avec la **stratégie d'invalidation dès le premier jour** : cache versionné par `BUILD_ID`, `skipWaiting()` + `clients.claim()`, purge des vieux caches à l'`activate` (cf. décision 7). Enregistrement **post-login uniquement**, composant client dans le layout dashboard (décision 6) ; purge caches + snapshot au logout. Page `/hors-ligne` minimale : bandeau « Hors ligne », rien d'autre. Test : DevTools offline → fallback servi ; redéploiement → ancienne version évincée.
2. **Cartes pures.** Marées du jour + coef, poubelles, règles/rotation été — importés de `lib/` (pur, testé par #34), calculés côté client. Mesurer le poids des tables marées dans le bundle client (~50-100 Ko attendus) et tenir le budget < 500 Ko (décision 10). La page prend la grammaire visuelle du dashboard, **photo `house.jpg` incluse et précachée**.
3. **Snapshot applicatif.** Hook client qui, à chaque ouverture EN LIGNE du dashboard, stocke en localStorage : séjours M−3 → M+12, nom de famille de l'utilisateur, timestamp. La page offline rend le calendrier lecture seule + « ta famille », avec le bandeau **à trois états** de la décision 8 (neutre < 7 j, avertissement ≥ 7 j, « pas encore de synchro » si absent). Dégradation propre sans snapshot (absent ou évincé iOS) : les cartes pures restent.
4. **Contenu statique complet.** Infos pratiques, numéros utiles, mdp wifi (déplacer la constante de `MaisonStatus.tsx` vers `lib/config.ts` au passage), lignes grisées « indisponible hors ligne » (webcam, demandes, stats, Freebox).
5. **Durcissement + réel.** Tests Vitest sur les helpers purs ajoutés (infra #34), **test bloquant sur un vrai iPhone** (installation PWA, mode avion, éviction de stockage — cf. décision 9), vérif du flux de mise à jour du SW, vérif de la purge au logout, docs (CHANGELOG, spec → implémentée).

**Constat qui dé-risque la décision n°1 (mdp wifi)** : le mot de passe est DÉJÀ une constante en dur dans un composant client (`app/dashboard/a-propos/MaisonStatus.tsx`) — il est donc déjà présent en clair dans le bundle JS téléchargé par tout navigateur authentifié. L'inclure dans la page offline ne dégrade pas la posture de sécurité existante.

## Décisions actées (21 juillet 2026) — ex-questions ouvertes

Les quatre questions laissées en suspens le 20 juillet sont tranchées. Elles ne rouvrent pas.

### 6. Précache **post-login uniquement**

Le SW n'est enregistré que depuis le layout dashboard, donc jamais avant authentification. `/hors-ligne` reste **derrière le middleware auth** comme le reste de l'app : elle n'est pas une page publique, elle est une entrée de cache que seul un navigateur déjà passé par le login possède.

Conséquence assumée : **un appareil jamais connecté n'a pas d'offline.** C'est le bon défaut — sur un téléphone neuf, il n'y a de toute façon rien de local à afficher.

Conséquence sur la déconnexion : le logout doit **purger les caches SW et le snapshot** (`caches.delete` + `localStorage.removeItem`). Sinon un appareil déconnecté garde mdp wifi et dates de séjours accessibles hors ligne — exactement ce que la décision n°1 acceptait *pour un appareil authentifié*, pas au-delà.

### 7. Fraîcheur du SW : cache versionné par build, `skipWaiting`, **pas de prompt de reload**

Le risque « SW qui sert du périmé » est **structurellement faible ici**, et c'est le périmètre qui le rend faible, pas la stratégie de cache : **le SW ne met jamais en cache une page vivante de l'app.** Il ne connaît que `/hors-ligne` et ses assets. Toute navigation réelle est network-first — le fallback n'est servi que si le fetch échoue. Il n'existe donc aucun scénario « la famille voit une vieille version du dashboard ».

Ce que ça autorise :

- **Cache versionné par `BUILD_ID`**, purge des vieux caches à l'`activate`.
- **`skipWaiting()` + `clients.claim()`** sans prompt de reload. Le prompt existe pour éviter qu'un onglet ouvert mélange ancien HTML et nouveaux assets — impossible quand on ne sert pas le HTML de l'app.
- Pire cas résiduel : `/hors-ligne` rend les règles/marées d'un build vieux de quelques jours. Sur du contenu qui bouge de quelques commits par mois, c'est du bruit.

**Ce qui bouge vraiment (le calendrier) n'est pas dans le cache SW du tout** — il est dans le snapshot applicatif, rafraîchi à chaque ouverture en ligne. Les deux problèmes de fraîcheur sont séparés par construction, et le seul qui compte a son propre mécanisme.

### 8. Fraîcheur du snapshot : seuil de péremption visible

Précision issue de l'état réel du calendrier (juillet 2026) : **l'année suivante est vide et va se remplir sur ~6 mois.** Un snapshot périmé est donc **systématiquement optimiste** — il montre libre ce qui vient d'être pris. C'est le risque produit n°3, aggravé par la phase de remplissage.

Mitigation ajoutée au bandeau (déjà prévu) :

- Snapshot < 7 jours → bandeau neutre « Dernière synchro : {date} ».
- Snapshot ≥ 7 jours → bandeau **d'avertissement** : « Snapshot du {date} — des séjours ont pu être posés depuis. »
- Pas de snapshot → « Pas encore de synchro », cartes pures seules.

### 9. iOS est la cible principale, pas un cas à vérifier

Confirmé : la majorité de la famille est sur iPhone avec la PWA installée — et c'est **mesuré**, pas supposé : `PWADetector` alimente `last_is_pwa` / `last_device`, visibles dans l'admin analytics.

Ça change le statut d'iOS dans le chantier : Safari iOS n'est pas un environnement à tester en fin de parcours, c'est **l'environnement de référence**. En conséquence :

- Le test sur vrai iPhone (étape 5) est **bloquant**, pas un nice-to-have.
- L'éviction de stockage iOS est une **contrainte de conception**, pas un bug à contourner : le snapshot comme le cache peuvent disparaître. Chaque surface doit dégrader proprement — c'est du best-effort explicite, jamais une garantie affichée à l'utilisateur.
- Avant de démarrer, **relire l'analytics** pour chiffrer la répartition réelle (iOS/Android, PWA/navigateur). Le déclencheur du chantier est un usage réel ; sa cible se lit dans la même donnée.

### 10. Poids client : accepté, **+ la photo de la maison précachée**

Les ~50-100 Ko de tables marées passent — ordre de grandeur admis pour la valeur rendue. Ajout : **`public/house.jpg` (141 Ko) entre dans le précache**, pour que la page hors-ligne garde l'identité visuelle du dashboard plutôt que d'être un pense-bête gris.

Budget de précache visé : **< 500 Ko** (photo + icônes + JS/CSS de `/hors-ligne`). Au-delà, on coupe — en commençant par une version réduite de la photo, pas par les données.

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
