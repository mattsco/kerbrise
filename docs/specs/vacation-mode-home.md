# Spec — Mode "Vacances" sur la home (#26)

> **Statut** : ✅ Fait (16 juin 2026), en `[Unreleased]` — pas encore release. Périmètre conditions ; unification des fragments non faite (cf. plus bas).
> **Type** : Feature moyenne
> **Cible** : Fait, en attente de release
> **Estimation initiale** : ~3-4h
> **Dernière MAJ** : 16 juin 2026

## ✅ Ce qui a été fait

Le "mode vacances" a été implémenté **non pas comme des widgets** mais comme un **enrichissement de la bannière contextuelle** du dashboard (cas A/B, quand `currentlyAt` est vrai). L'approche widget/carte dédiée a été **explicitement rejetée au design** (« je n'aime pas les widgets ») au profit de lignes texte intégrées au style aéré de la bannière.

Lignes ajoutées quand quelqu'un est sur place :
- **Marées** : les 2 prochaines (heure + pleine/basse, flèches ↑/↓) + **coef** en pastille. Repli `Marée du jour : coef X` si le scraper tombe.
- **Mer** : « mer à 13° ».
- **Météo du jour** : min / max + écart de la max vs hier + heure du coucher du soleil.
- **Tendance semaine** : phrase au ton léger, générée par règles déterministes (pas de LLM).

**Sources** (chacune dégrade indépendamment, fetch serveur caché + timeout, mode dégradé ligne par ligne) :
- temp. eau → API **Stormglass** (clé `STORMGLASS_API_KEY` en env) — `lib/sea-temp.ts`. (Scraping cabaigne/letelegramme abandonné : 403 Cloudflare depuis Vercel.)
- heures marée → scraper `maree.info` — `lib/maree-info.ts`
- coef marée → statique `lib/tides.ts`
- météo / sunset / tendance 7j → Open-Meteo Forecast — dans `lib/conditions.ts`

**Code** : `lib/conditions.ts` (orchestration), `app/dashboard/BannerConditions.tsx` (rendu, sous `<Suspense>`), branché dans `ContextualBanner`. `app/api/tides/route.ts` expose aussi les marées brutes.

**Tranché / abandonné** :
- Pas de fallback Open-Meteo Marine pour la temp. eau (lisait ~19° vs ~13-15° réels).
- Pas de recommandations d'événements ni de restos (aucune source fiable — risque d'info fausse).
- Pistes temp. eau letelegramme (Rothéneuf) et lachainemeteo (Val) abandonnées : pages non récupérables pour caler/vérifier le scraper.

**Reste éventuellement à faire (post-#26, cf. ROADMAP)** : absorber les autres fragments « la maison maintenant » (webcam, poubelles) dans cette surface ; ajouter un log d'échec de scrape (checkpoint #28). La vision « widgets » ci-dessous est conservée comme contexte historique mais n'est PAS la forme retenue.

## Vision

Kerbrise a deux usages dans le temps :
- **Le reste de l'année** → c'est une **app de réservation** (calendrier, demandes, validations)
- **Pendant un séjour sur place** → ça devient la **super-app de vacances** qui aide à profiter de Saint-Malo

L'idée : quand un utilisateur est **physiquement en séjour à Kerbrise**, sa home page se transforme et affiche des **widgets utiles au quotidien sur place**, au lieu (ou au-dessus) des cartes de navigation habituelles.

## Déclencheur

Le mode vacances s'active quand l'utilisateur est **en séjour actif** à Kerbrise.

- Réutiliser la détection `currentlyAt` déjà présente dans le code (un séjour approuvé de l'utilisateur englobe la date du jour)
- Si `currentlyAt` est vrai → afficher les widgets vacances
- Sinon → home classique (cartes de navigation actuelles)

> À confirmer : est-ce qu'on affiche les widgets **au-dessus** des cartes habituelles, ou est-ce qu'on **remplace** la home par un vrai dashboard vacances ? Penser à garder un accès facile au reste de l'app.

## Widgets envisagés

Saint-Malo = côte bretonne avec **l'une des plus grandes amplitudes de marée d'Europe** (jusqu'à 12-14m). Les marées sont donc LE widget le plus pertinent (baignade, pêche à pied, accès aux îlots type Grand Bé accessibles seulement à marée basse).

Par ordre de pertinence :

1. **🌊 Marées** (le plus utile)
   - Prochaine marée haute / basse avec horaire
   - Coefficient de marée (important en Bretagne)
   - Idéalement un mini-graphe de la journée

2. **🌡️ Température de la mer**
   - Pour savoir si la baignade est envisageable

3. **☀️ Météo Saint-Malo**
   - Température air, conditions, vent (le vent compte beaucoup sur la côte)
   - Prévision du jour + lendemain

4. **🦪 Horaires marché** (bonus)
   - Jours et horaires des marchés de Saint-Malo / Saint-Servan

5. **🍽️ Restaurants ouverts** (bonus, plus complexe)
   - Suggestions de restos ouverts maintenant à proximité

## APIs à explorer

> Point ouvert principal : choisir les sources de données. Pistes :

| Donnée | Pistes d'API | Notes |
|--------|-------------|-------|
| Météo | **Open-Meteo** (gratuit, sans clé), Météo-France, OpenWeatherMap | Open-Meteo est gratuit et sans clé → idéal pour démarrer |
| Température mer | **Open-Meteo Marine API** (gratuit), Stormglass | Open-Meteo Marine fait la sea surface temperature |
| Marées | SHOM (officiel FR, accès restreint), WorldTides (freemium), Stormglass (freemium) | À investiguer — la donnée marée fiable est souvent payante au-delà d'un quota |
| Coefficient marée | SHOM, marée.info | Spécifique France, à creuser |
| Marché / restos | Données statiques en dur ? Google Places ? | Les marchés changent peu → peut-être juste hardcodé |

**Coordonnées Saint-Malo** : ~48.65°N, -2.02°W (à affiner selon l'emplacement exact de la maison).

## Architecture pressentie

```
components/vacances/
├── VacancesWidgets.tsx        ← conteneur, affiché si currentlyAt
├── TidesWidget.tsx
├── SeaTempWidget.tsx
├── WeatherWidget.tsx
└── (MarketWidget, RestaurantsWidget — bonus)

lib/vacances/
├── tides.ts                   ← fetch + parsing marées
├── weather.ts                 ← fetch météo + temp mer
└── (cache helper)

app/api/vacances/
└── (route(s) proxy pour appeler les APIs externes côté serveur + cache)
```

## ⚠️ Points d'attention

### Caching obligatoire
Ne PAS appeler les APIs externes à chaque chargement de page :
- Météo / mer : rafraîchir ~1×/heure suffit
- Marées : les horaires du jour sont connus à l'avance → 1 fetch/jour suffit
- Utiliser un cache serveur (Next.js `revalidate`, ou une table Supabase `weather_cache` mise à jour périodiquement)
- Vu qu'il y a max ~14 users, et souvent quelques-uns en même temps sur place, un cache partagé évite de spammer les APIs

### Quotas API
Plusieurs APIs marées sont freemium avec quota. Avec le cache (1 fetch/jour pour les marées), on reste largement dans les limites gratuites.

### Données en dur acceptables
Pour les marchés (jours/horaires quasi fixes), inutile d'une API — une simple constante dans le code suffit et c'est plus fiable.

## Étapes d'implémentation (estimation)

| Étape | Contenu | Effort |
|-------|---------|--------|
| 1 | Détection mode vacances (réutiliser `currentlyAt`) + conteneur widgets | ~30 min |
| 2 | Widget météo + temp mer via Open-Meteo (gratuit, simple) | ~1h |
| 3 | Widget marées (après choix de l'API) + cache | ~1.5h |
| 4 | Widgets bonus (marché en dur, restos) | ~1h |
| 5 | Polish responsive + tests | ~30 min |

**Total estimé** : ~3-4h (hors widgets bonus).

## Questions ouvertes (à trancher avant de coder)

- Widgets **au-dessus** des cartes nav, ou home **entièrement remplacée** en mode vacances ?
- Quelle API marées (fiabilité vs coût vs simplicité) ?
- Coordonnées exactes de la maison pour les données localisées ?
- Affiche-t-on les widgets uniquement à ceux qui sont sur place, ou aussi à ceux qui ont un séjour imminent (J-2) pour préparer ?
- Météo : juste le jour, ou prévision sur la durée du séjour ?

## Lien avec d'autres features

- Réutilise la détection `currentlyAt` (déjà dans le code, utilisée par la bannière contextuelle du dashboard — voir `lib/dashboard-banner.ts`).

## Liens

- Météo + mer gratuit : [Open-Meteo](https://open-meteo.com/) (weather API + marine API, sans clé)
- Marées (pistes) : SHOM, WorldTides, Stormglass
- Détection séjour actif : `lib/dashboard-banner.ts`
