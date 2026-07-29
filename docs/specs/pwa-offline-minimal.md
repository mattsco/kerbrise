# Spec — Offline PWA minimal (#37)

> **Statut** : ✅ **Livrée** — implémentée le 21 juillet 2026, validée sur iPhone puis mergée sur `master` le 29 juillet 2026, en production sur kerbrise.fr
> **Type** : Feature / résilience
> **Estimation** : ~2 j (service worker + page offline + snapshot calendrier)
> **Dernière MAJ** : 29 juillet 2026

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

### 2. Calendrier — snapshot LECTURE SEULE de tous les séjours

- Quand l'utilisateur ouvre le **calendrier en ligne**, un composant client recopie en local les séjours que la page a déjà chargés, avec un timestamp. ~45 Ko, aucune requête supplémentaire. *(Révisé le 21 juillet 2026 — cf. décision 18. La version initiale prévoyait une fenêtre glissante M−3 → M+12 écrite depuis le dashboard via des requêtes dédiées.)*
- Hors ligne : rendu lecture seule avec bandeau bien visible **« Dernière synchro : {date} »**. Aucune action possible (pas de demande, pas de vote).
- Les 3 périodes d'été + attribution par priorité se recalculent en pur même sans snapshot ; seuls les séjours réels en dépendent.
- Le snapshot est **applicatif** (stockage local géré par l'app), jamais un cache HTTP de réponses Supabase dans le SW.

## Décisions actées (20 juillet 2026)

1. **Mot de passe wifi : inclus dans le contenu offline.** Donc stocké en clair dans le cache du navigateur, hors auth. Choix de sécurité explicite : appareils familiaux, risque faible, et le mdp est de toute façon écrit sur la box. Conséquence directe sur la question auth ci-dessous.
2. **Données famille dans le stockage local, hors auth** (snapshot séjours + nom de famille de l'utilisateur) : accepté. Des dates de séjours — moins sensible que le mdp wifi, même logique d'appareils familiaux.
3. **Fraîcheur du calendrier** : le vrai risque produit est un calendrier périmé qui laisse croire qu'une période est libre. Mitigation actée : bandeau de date de synchro + lecture seule stricte. Pas de sync en arrière-plan.
4. ~~**Fenêtre calendrier : M−3 → M+12 glissants**~~ — **abandonnée le 21 juillet 2026 (décision 18)** : on garde tous les séjours. 166 lignes en base, ~45 Ko ; la fenêtre n'économisait rien et ajoutait un cas limite.
5. **UX hors ligne : surface dédiée, PAS le vrai dashboard grisé** (20 juillet 2026). Le dashboard est une page serveur `force-dynamic` : hors ligne, il n'existe pas — le montrer « avec des sections désactivées » exigerait de le convertir en app shell client précaché, une réarchitecture de la home qui multiplie le risque d'invalidation SW. À la place :
   - Toute navigation hors ligne (y compris l'ouverture de la PWA sur `/dashboard`) → le SW sert `/hors-ligne`.
   - `/hors-ligne` reprend **la grammaire visuelle du dashboard** (mêmes cartes, même ordre) pour ne pas dépayser : bandeau « Hors ligne — dernière synchro {date} » en tête, puis marées, poubelles, calendrier snapshot, règles/rotation, infos pratiques, mdp wifi.
   - Les sections impossibles offline (webcam, demandes/votes, stats, statut Freebox) apparaissent en **ligne grisée « indisponible hors ligne »** plutôt que de disparaître silencieusement — on explique, on ne laisse pas croire à un bug.
   - **Aucun lien vers les vraies pages de l'app** (elles échoueraient) : la surface offline est autosuffisante. Réseau revenu = navigation normale, le fallback n'est jamais servi quand le fetch réussit.

## Plan d'implémentation (5 étapes, chacune livrable seule)

> Découpage acté le 20 juillet 2026. Principe : l'étape risquée (cycle de vie du SW) en PREMIER, isolée sur un contenu trivial — pas à la fin quand tout le contenu en dépend.

> ⚠️ **Le mode hors ligne ne se teste pas en `next dev`.** Turbopack fait dépendre l'amorçage de son runtime client du chunk HMR : sans lui en cache, rien ne s'hydrate ; avec lui, il recharge la page en boucle dès qu'il perd le serveur. Dans les deux cas le dev ment. La vérification se fait sur `npm run build && npm run start`. Cf. `docs/guides/pieges-connus.md`.

1. ✅ **Service worker + squelette `/hors-ligne`** (fait le 21 juillet 2026). SW à la main (< 100 lignes) avec la **stratégie d'invalidation dès le premier jour** : cache versionné par `BUILD_ID`, `skipWaiting()` + `clients.claim()`, purge des vieux caches à l'`activate` (cf. décision 7). Enregistrement **post-login uniquement**, composant client dans le layout dashboard (décision 6) ; purge caches + snapshot au logout. Page `/hors-ligne` minimale : bandeau « Hors ligne », rien d'autre. Test : DevTools offline → fallback servi ; redéploiement → ancienne version évincée.
2. ✅ **Cartes pures** (fait le 21 juillet 2026). Marées du jour + coef, poubelles (composant `NextCollections` réutilisé tel quel), rotation été — importés de `lib/` (pur, testé par #34). Photo `house.jpg` précachée. Budget mesuré, cf. décision 10.

   **Tout est calculé après le montage, jamais au rendu serveur.** Le HTML est figé dans le cache le jour du précache : rendre les marées côté serveur reviendrait à afficher celles de ce jour-là comme celles d'aujourd'hui — une donnée fausse et parfaitement crédible, exactement ce que la décision 8 combat sur le calendrier. Sans JS, la page montre des tirets et une explication : on préfère ne rien dire que mentir sur une heure de marée.
3. ✅ **Snapshot applicatif** (fait le 21 juillet 2026, révisé le même jour → décision 18) → `/hors-ligne/calendrier` (décision 12). Composant client monté sur **la page calendrier**, qui recopie en localStorage les séjours déjà chargés par le serveur (tous, pas une fenêtre) + le nom de famille + un timestamp, sans aucune requête. La page offline rend le calendrier lecture seule + « ta famille », avec le bandeau **à trois états** de la décision 8 (neutre < 7 j, avertissement ≥ 7 j, « pas encore de synchro » si absent). Dégradation propre sans snapshot (absent ou évincé iOS) : les cartes pures restent.
4. ✅ **Contenu statique complet** (fait le 21 juillet 2026) → `/hors-ligne/a-propos` (décision 12). Infos pratiques, numéros utiles, mdp wifi (déplacer la constante de `MaisonStatus.tsx` vers `lib/config.ts` au passage), lignes grisées « indisponible hors ligne » (webcam, demandes, stats, Freebox).
5. ✅ **Durcissement + docs** (fait le 21 juillet 2026, test iPhone fait le 29 — cf. décision 20). Tests Vitest sur les helpers purs ajoutés (infra #34), test sur un vrai iPhone (cf. décision 9), vérif du flux de mise à jour du SW, vérif de la purge au logout, docs (CHANGELOG, spec → livrée).

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

- Le test sur vrai iPhone (étape 5) est **bloquant**, pas un nice-to-have. *(Levé le 29 juillet 2026 — cf. décision 20.)*
- L'éviction de stockage iOS est une **contrainte de conception**, pas un bug à contourner : le snapshot comme le cache peuvent disparaître. Chaque surface doit dégrader proprement — c'est du best-effort explicite, jamais une garantie affichée à l'utilisateur.
- Avant de démarrer, **relire l'analytics** pour chiffrer la répartition réelle (iOS/Android, PWA/navigateur). Le déclencheur du chantier est un usage réel ; sa cible se lit dans la même donnée.

### 10. Poids client : accepté, **+ la photo de la maison précachée**

Les ~50-100 Ko de tables marées passent — ordre de grandeur admis pour la valeur rendue. Ajout : **`public/house.jpg` (141 Ko) entre dans le précache**, pour que la page hors-ligne garde l'identité visuelle du dashboard plutôt que d'être un pense-bête gris.

**Budget mesuré** (build de production). Le « < 500 Ko » initial ne précisait pas lequel des deux il visait : tranché, **le seuil porte sur le transféré** — c'est ce que l'installation coûte à un téléphone en 4G.

| | Transféré | Sur disque |
|---|---|---|
| 1 page (étape 2) | 360 Ko | 925 Ko |
| **6 pages (final)** | **810 Ko** | **2 820 Ko** |

⚠️ **Le seuil de 500 Ko n'est pas tenu, et il était irréaliste.** Il a été posé quand la surface hors ligne comptait *une* page sans calendrier. Le dépassement vient d'un choix produit assumé, pas d'un laisser-aller : le calendrier hors ligne réutilise la vraie vue de l'app, qui embarque `date-holidays` et la machinerie de grille (~300 Ko à elle seule). Le remplacer par une grille simplifiée économiserait ~300 Ko au prix d'une divergence visuelle garantie — mauvais échange.

Contrairement à ce qu'on supposait, **le gros morceau n'a jamais été la photo** (138 Ko) mais le JS. Coût propre de chaque page ajoutée, mesuré : calendrier 7 Ko, profil 5 Ko, télé 474 Ko *avant* optimisation des images (cf. décision 16), 136 Ko après. Les pages partagent leurs chunks : en ajouter une ne coûte presque rien, **sauf si elle apporte ses propres images ou une grosse dépendance**.

### 11. Dépendance annuelle des données de marée

`lib/data/tides-times-2026.ts` ne couvre que **2026**. En janvier 2027, la carte marées affichera « horaires non disponibles » tant qu'une table 2027 n'est pas committée.

La dégradation est propre (`getOfflineTides` renvoie `null`, la carte l'explique), mais elle ajoute une surface au problème que **#33 traite déjà** (« Couverture des données offline », échéance dure au 31/12/2026, spec `docs/specs/data-coverage-health.md`) : au 1ᵉʳ janvier 2027, bannière vacances, TRMNL, Garmin **et désormais la page hors ligne** passent en mode dégradé silencieux.

Rien de nouveau à décider ici — mais le health check de #33 doit compter la page hors ligne parmi ses consommateurs, et l'argument gagne en force : c'est maintenant aussi ce qu'on voit pendant une panne de réseau.

### 12. Plusieurs pages hors ligne, calquées sur l'architecture en ligne (21 juillet 2026)

La décision 5 disait « surface dédiée reprenant la grammaire visuelle du dashboard ». À l'usage, une **page unique** empilant marées, poubelles et rotation été s'est révélée fouillis — et l'étape 2 n'en montrait que trois cartes, avant le calendrier, les infos pratiques et le mot de passe wifi.

La surface offline devient donc un **miroir de l'architecture en ligne** :

| Hors ligne | Miroir de |
|---|---|
| `/hors-ligne` — conditions du jour visibles sans clic, puis cartes de section | `/dashboard` |
| `/hors-ligne/a-propos` | `/dashboard/a-propos` |
| `/hors-ligne/a-propos/regles` | `/dashboard/a-propos/regles` |
| `/hors-ligne/calendrier` | `/dashboard/calendrier` |
| `/hors-ligne/profil` — famille + priorité, calcul pur | `/dashboard/profil` |
| `/hors-ligne/a-propos/tele` — guide partagé | `/dashboard/a-propos/tele` |

Ça ne rouvre pas la décision 5 : ce sont des pages *hors ligne*, la surface reste autosuffisante et ne pointe jamais vers les vraies pages de l'app.

Deux conséquences techniques :

1. **Navigation en `<a>`, jamais en `<Link>`.** Le routeur de Next irait chercher une charge RSC sur le réseau, qui échoue précisément quand ces pages servent. Un `<a>` provoque une navigation complète, donc interceptée par le SW.
2. **Le SW sert la page demandée si elle est en cache**, et le hub seulement en dernier recours — c'est ce qui fait marcher la navigation entre sections. Les pages partagent leurs chunks : ajouter une section ne coûte que son HTML (~13 Ko). Mesuré après découpage : 990 Ko sur disque contre 925 pour la page unique.

**Les marées reprennent la grammaire exacte de la bannière en ligne** (`BannerConditions`) : ligne compacte, flèches PM/BM, coef en pastille, et surtout **les 2 prochaines marées** plutôt que les quatre du jour. La sélection (`upcomingTides`) a été **déplacée de `conditions.ts` vers `lib/tides-times.ts`** pour être partagée au lieu d'être recopiée — `conditions.ts` fait du réseau (météo) et ne peut pas être importé côté client. Les deux affichages ne peuvent donc pas diverger, et les helpers sont désormais testés (7 tests ajoutés).

### 13. Fidélité à l'app en ligne (21 juillet 2026)

Demande explicite en fin d'implémentation : la surface hors ligne doit ressembler **le plus possible** à l'app en ligne, avec un simple bandeau expliquant pourquoi certaines sections sont inaccessibles.

Ce que ça a changé par rapport à la décision 5 (« lignes grisées ») :

- Le hub reprend le **chrome complet du dashboard** — header collant, hero photo, mêmes `ActionCard` dans le même ordre.
- Les sections indisponibles ne sont plus une liste à part : elles restent **à leur place dans la grille**, grisées, en pointillés, avec la mention « hors ligne ». L'app paraît complète mais en veille, pas amputée.
- Le calendrier hors ligne réutilise **la vraie vue calendrier** (`CalendarMobileView`) avec des callbacks neutres, plutôt qu'une grille « ressemblante » qui aurait divergé à la première évolution.
- `NextCollections` et `LinksContactsSection` sont réutilisés **tels quels** : déjà purs ou figés, donc fonctionnels sans réseau.

⚠️ **Le hero n'affiche pas le prénom de l'utilisateur**, contrairement au dashboard. Ce HTML est mis en cache une fois et resservi tel quel : personnalisé, il accueillerait toute la famille par le prénom du dernier connecté.

### 14. Robustesse du précache (21 juillet 2026)

Deux corrections issues de la vérification de l'étape 3 :

1. **Précache séquentiel.** La version parallèle (`Promise.all` sur les 4 pages) **bloquait l'installation indéfiniment** en gardant quatre corps de réponse ouverts pendant le clonage. Symptôme trompeur : cache créé mais vide, worker figé en `installing` — ni installé, ni en échec, donc jamais réessayé.
2. **Toutes les requêtes du SW passent par `fetchWithTimeout` (10 s).** Un `fetch` qui pend laisse le worker bloqué pour toujours. C'est le scénario du réseau mobile à moitié mort — précisément celui où cette fonctionnalité est censée servir.

### 15. Sortir du mode hors ligne (21 juillet 2026)

Défaut relevé au test : **on ne savait pas comment sortir**. `/hors-ligne` existe aussi côté serveur, donc actualiser la page une fois reconnecté la resert à l'identique — il fallait retaper l'URL du dashboard à la main.

`OfflineAutoExit`, monté dans le shell, ramène dans l'app dès que le réseau revient, **vers la page équivalente** (`/hors-ligne/a-propos` → `/dashboard/a-propos`) et non vers le dashboard : on reprend là où on était.

Deux détails qui comptent :

- **On ne se fie pas à `navigator.onLine`** : il est `true` dès qu'une interface réseau est active, y compris sur un wifi sans internet — exactement la panne de box qu'on cherche à couvrir. On sonde donc `/sw.js` (servi en `no-store`, donc impossible à satisfaire depuis un cache) avant de basculer.
- **Sonde périodique toutes les 15 s** en plus de l'événement `online`, qui ne se déclenche pas quand le wifi reste connecté mais que la box reprend.
- `location.replace` et non `assign` : la page hors ligne ne doit pas rester dans l'historique, sinon « retour » y ramène.

### 16. Densité du texte et poids des images (21 juillet 2026)

Deux retours après le premier essai en preview :

**« On lit Hors ligne huit fois rien que sur le dashboard. »** Supprimés : l'étiquette « HORS LIGNE » sur chaque carte désactivée, les descriptions « Nécessite le réseau », et la première phrase du bandeau. Les cartes indisponibles reprennent **le sous-texte exact de la version en ligne** : le fond atténué, le pointillé et l'absence de chevron disent déjà qu'elles sont inactives, et le bandeau l'a expliqué une fois. Le mot répété sept fois devenait du bruit.

**Images de la page télé.** Servies `unoptimized` (seule forme précachable), les originales coûtaient 471 Ko — plus que tout le reste de l'offline réuni. `public/tele/offline/` contient des copies réduites à ≤ 760 px, soit **136 Ko pour un rendu identique** à la taille où on les regarde sur un téléphone. En ligne, rien ne change : Next optimise les originales à la volée. La vidéo de démonstration (4,1 Mo) n'est **jamais** précachée — remplacée hors ligne par une note explicite.

### 17. Impact sur l'expérience EN LIGNE — mesuré (21 juillet 2026)

Question posée avant le merge : est-ce que l'offline ralentit l'app en ligne ? Mesuré en build de production, 10 à 20 échantillons par cas. Les logs serveur ne contenaient rien d'exploitable (uniquement les lignes de démarrage) — la mesure est donc côté navigateur.

| | Sans SW | Avec SW | Après correctifs |
|---|---|---|---|
| Navigation (médiane) | 3,8 ms | 6,3 ms | **4,8 ms** |
| Asset `/_next/static` | 1,7 ms | 2,5 ms | 2,5 ms |
| 1ʳᵉ requête après inactivité | — | 17,4 ms | **6-10 ms** |

**Le coût est réel et permanent** : une fois le SW actif, *chaque* navigation et *chaque* asset `/_next/static` passe par lui — 15 à 25 requêtes proxifiées par page. Ce n'est pas nul, et on ne peut pas le supprimer sans renoncer à l'offline.

Deux correctifs appliqués :

1. **`navigationPreload`** — le navigateur lance la requête réseau *en parallèle* du réveil du worker, au lieu d'attendre qu'il ait démarré. C'est ce qui divise par deux le cas « première navigation après inactivité », de loin le pire. Sans lui, chaque retour dans l'app après quelques minutes payait le démarrage du worker.
2. **`lib/idle.ts`** — l'enregistrement du SW et l'écriture du snapshot attendent l'événement `load` **puis** `requestIdleCallback`. Avant, un `setTimeout` de 2 s pouvait se déclencher en plein chargement sur une connexion lente, soit exactement le moment à éviter. Les pages en ligne sont prioritaires par construction, pas par espérance.

⚠️ **Ces chiffres viennent d'un Mac sur localhost**, où le réseau est quasi nul : ils isolent le surcoût du service worker, ils ne prédisent pas l'expérience réelle. Sur un iPhone d'entrée de gamme, le démarrage d'un worker se compte plutôt en 50-150 ms — d'où l'importance du `navigationPreload`.

**Non remesuré sur iPhone.** Le test du 29 juillet (décision 20) a validé le *comportement* hors ligne, pas les latences : personne n'a chronométré de navigation sur l'appareil. Le surcoût par navigation reste donc mesuré uniquement sur localhost. Si une lenteur est signalée en usage réel, c'est la première piste à regarder.

**Ce qui n'est PAS garanti** : le précache télécharge ~800 Ko en arrière-plan à chaque nouveau déploiement. C'est après le `load` et en temps mort, donc invisible sur une connexion correcte — mais sur un réseau très lent, cette bande passante est prise à quelque chose.

### 18. Le snapshot s'écrit depuis le calendrier, et garde tout (21 juillet 2026)

Révision de la décision 4 et de l'étape 3, sur proposition de l'utilisateur. Trois changements liés, tous des simplifications.

**Où.** Le snapshot s'écrivait à chaque chargement du dashboard, via **deux requêtes Supabase dédiées**. Il s'écrit désormais depuis `/dashboard/calendrier`, à partir des séjours que la page **a déjà chargés côté serveur** (`getCalendarBookings`). Coût : **zéro requête, zéro octet de réseau**. C'est la donnée qui est déjà à l'écran, recopiée en local.

**Quand.** Après `load` puis un temps mort du navigateur (`lib/idle.ts`), donc jamais pendant l'affichage de la grille.

**Quoi.** Fin de la fenêtre glissante M−3 → M+12 : on garde **tous** les séjours actifs. Mesuré sur la vraie base : **166 séjours de 2015 à 2027, ~45 Ko de JSON**. Découper une fenêtre dans si peu de données ajoutait un cas limite (séjour à cheval sur une borne) pour une économie nulle. `getCalendarBookings` n'ayant de toute façon aucun filtre de date, la fenêtre était un filtrage *supplémentaire* de données déjà chargées.

**Conséquence assumée** : qui n'ouvre jamais le calendrier n'a pas de calendrier hors ligne — ni de profil hors ligne, qui dépend du même snapshot. Les deux surfaces le disent explicitement (« ouvre le calendrier une fois connecté »). En échange, le dashboard ne paie plus rien : c'est la page la plus ouverte de l'app, et elle n'avait aucune raison de porter le coût.

Format passé en **v2** : un snapshot v1 est ignoré, pas migré — il se réécrit à la première visite du calendrier.

### 19. Le profil suit le même principe (21 juillet 2026)

Extension de la décision 18 à `/dashboard/profil` : la page recopie en local ce qu'elle a **déjà chargé** (nom, e-mail, rôles, compteur de séjours), sans requête supplémentaire. Les autres pages hors ligne n'ont rien à capturer — marées, poubelles, règles, wifi, contacts et guide télé sont déjà committés dans le code.

**Correction d'un excès de prudence.** Ces champs avaient été exclus au motif qu'ils « afficheraient les infos du dernier connecté à toute la famille ». C'est vrai d'un rendu SERVEUR figé dans le HTML précaché, qui est partagé par tous ceux qui ouvrent l'app sur l'appareil. C'est faux d'un `localStorage` : il est propre au navigateur et purgé à la déconnexion — exactement le traitement déjà réservé au nom de famille.

**Clé séparée** (`kerbrise-offline-profil`) et non un objet commun : chaque snapshot est écrit par la page qui possède la donnée, et une clé partagée ferait écraser les champs de l'une par l'autre selon l'ordre de visite.

**Dégradation en escalier**, vérifiée en production serveur coupé :

| Ce que l'utilisateur a ouvert en ligne | Ce qu'il voit hors ligne |
|---|---|
| Rien | Invitation à se connecter |
| Le calendrier | Famille + priorité été et pont de mai |
| Le profil | En plus : nom, e-mail, rôle, nombre de séjours |

### 20. Validation iPhone et levée de la condition bloquante (29 juillet 2026)

La décision 9 posait le test sur vrai iPhone comme **bloquant**. Il a été fait le 29 juillet 2026, sur l'iPhone d'un membre de la famille, après le merge donc directement sur kerbrise.fr.

**Ce qui a été vérifié** : Safari iOS, chargement du site, passage en **mode avion** → la surface hors ligne s'affiche. Le mécanisme central — SW installé, précache complet, fallback de navigation servi quand le réseau est mort — fonctionne sur l'environnement de référence.

**Ce qui n'a pas été vérifié**, et il faut le dire plutôt que de laisser croire à une validation complète :

- **PWA installée depuis l'écran d'accueil** : le test s'est fait dans Safari, pas dans l'app installée. Les deux partagent le même SW et le même cache d'origine, donc rien ne laisse attendre une divergence — mais ce n'est pas la même vérification.
- **Éviction de stockage iOS** : non reproduite (elle ne se déclenche pas à la demande). C'est du best-effort assumé depuis la décision 9 : chaque surface dégrade proprement sans snapshot, et aucune garantie n'est affichée à l'utilisateur.
- **Latences sur l'appareil** : non chronométrées (cf. décision 17).

**Condition bloquante levée** sur cette base, par décision de l'utilisateur. Le reliquat n'est pas un trou de conception, c'est du best-effort déjà documenté ; le signal qui compte désormais est l'usage réel de la famille, pas un test de plus.

⚠️ **Rappel de déploiement** : les appareils qui ont déjà la PWA installée ne prennent le SW qu'au prochain **rechargement complet** — le précache se fait donc au premier passage, pas à l'instant du déploiement.

## Signal de déclenchement (historique)

> Le chantier est livré. Cette section est conservée telle quelle : elle documente le raisonnement qui a précédé la décision de le faire, pas une condition encore en attente.

Ne pas construire sur hypothèse. Déclencheurs légitimes :
- quelqu'un de la famille se plaint *en vrai* d'avoir eu besoin d'une info app pendant une panne wifi/4G à la maison ;
- ou le monitoring RPi (#14) montre des coupures fréquentes.

Sinon, ça reste un joli chantier technique sans demande — exactement ce que la roadmap sait dire non.

## Hors périmètre (définitif)

- **Toute action hors ligne** : demandes, votes, approbations — flux transactionnels, network-only. Le calendrier offline est un snapshot lecture seule, pas un mode dégradé de l'app.
- **Cache HTTP de réponses Supabase dans le SW** — le snapshot calendrier est applicatif et explicite, jamais un cache réseau implicite.
- Background sync / notifications push (c'est #29, décision séparée).
- Workbox ou toute dépendance : si ça se fait, c'est un SW écrit à la main de < 100 lignes, dans l'esprit « ~1 Ko de CSS plutôt que 40 Ko de lib » du projet.
