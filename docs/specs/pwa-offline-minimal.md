# Spec — Offline PWA minimal (#37)

> **Statut** : 🌱 Embryon
> **Type** : Feature / résilience
> **Cible** : un jour peut-être — à ne faire que si l'envie vient
> **Estimation** : ~1 j (service worker + page offline) — à réévaluer après tranchage des questions ouvertes
> **Dernière MAJ** : 19 juillet 2026

## Problème

Kerbrise est une PWA **installée** sur les téléphones de la famille… sans service worker : `public/manifest.json` existe, mais si le réseau tombe, l'app installée affiche l'écran d'erreur navigateur. Or le produit **acte lui-même** que le réseau de la maison est faillible : carte statut Freebox sur À propos, projet RPi de monitoring wifi (#14 évolué).

L'ironie : c'est précisément **quand le wifi de la maison est mort** qu'on a besoin des infos pratiques — et l'app qui les contient devient inaccessible au même moment. Les données les plus utiles hors ligne (marées du jour, coefs) sont pourtant **déjà committées dans le bundle** — l'offline est presque gratuit côté données.

## Objectif (proposition, à trancher)

**Pas** d'offline générique de toute l'app (calendrier, demandes, approbations = flux Supabase, hors sujet). Un périmètre minimal :

1. Un **service worker** léger qui précache une unique page `/hors-ligne` + ses assets.
2. Cette page sert de **fallback de navigation** quand le fetch réseau échoue, et contient : marées du jour + coef (tables committées), horaires poubelles (logique `garbage-collection.ts`, pure), numéros/liens utiles (statiques).
3. Tout le reste de l'app : comportement réseau inchangé, network-first, aucun cache de données Supabase.

## Questions ouvertes (à trancher avant toute implémentation)

1. **Le mot de passe wifi.** L'info offline la plus demandée… mais la mettre dans une page précachée = stockée en clair dans le cache du navigateur, hors auth. Appareils familiaux, risque faible — mais c'est un choix de sécurité explicite à faire, pas un défaut d'implémentation. Alternative : l'exclure et le laisser derrière l'auth (il est de toute façon sur la box).
2. **Auth vs précache.** `/hors-ligne` doit être précachable → soit hors middleware auth (page publique sans donnée sensible), soit précachée post-login. La première option est plus simple mais contraint le contenu (pas de données famille).
3. **Marées côté client.** Les tables (`tides-times`, coefs) vivent côté serveur aujourd'hui. Pour une page offline, il faut les embarquer dans le bundle client de `/hors-ligne` (~50-100 Ko de données annuelles) + le calcul « aujourd'hui » en client. Faisable, mais à chiffrer.
4. **Fraîcheur du SW.** Un service worker mal invalidé qui sert une vieille version est pire que pas de SW (bugs fantômes impossibles à diagnostiquer à distance pour une famille non technique). Stratégie de mise à jour à définir (skipWaiting + reload prompt ? cache versionné par build ?). C'est LE risque du chantier — la raison de ne pas le faire « vite fait ».
5. **iOS.** La majorité de la famille est probablement sur iPhone : vérifier le comportement PWA + SW sur Safari iOS (support correct depuis 16.4, mais éviction de cache agressive — le fallback doit survivre à une éviction).

## Signal de déclenchement

Ne pas construire sur hypothèse. Déclencheurs légitimes :
- quelqu'un de la famille se plaint *en vrai* d'avoir eu besoin d'une info app pendant une panne wifi/4G à la maison ;
- ou le monitoring RPi (#14) montre des coupures fréquentes.

Sinon, ça reste un joli chantier technique sans demande — exactement ce que la roadmap sait dire non.

## Hors périmètre (définitif)

- Offline du calendrier, des demandes, des votes — flux transactionnels, network-only.
- Background sync / notifications push (c'est #29, décision séparée).
- Workbox ou toute dépendance : si ça se fait, c'est un SW écrit à la main de < 100 lignes, dans l'esprit « ~1 Ko de CSS plutôt que 40 Ko de lib » du projet.
