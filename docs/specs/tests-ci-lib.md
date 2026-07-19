# Spec — Tests sur `lib/` + CI minimale (#34)

> **Statut** : 📋 Spec validée
> **Type** : Qualité / outillage
> **Cible** : septembre–octobre 2026, **avant la saison de planification 2027**
> **Estimation** : ~une demi-journée (setup + premiers tests) ; enrichissement au fil de l'eau
> **Dernière MAJ** : 19 juillet 2026

## Problème

Le repo n'a **aucun test et aucune CI**. Pour une app familiale ce serait pardonnable, sauf que :

1. **La logique la plus critique est pure et sans I/O** — `dates.ts`, `families.ts`, `summer-priorities.ts`, `summer-placeholders.ts`, `tides.ts`, `tides-times.ts`, `db-errors.ts`, `validation/`. C'est exactement le code qu'on teste en une après-midi pour un coût marginal nul ensuite.
2. **Elle sera sollicitée à froid en novembre–février** pour la planification été 2027 — la première sous le **nouveau modèle pivot** (`SUMMER_PERIOD_1_START`, périodes de 21 j, dernier jour = pivot de la suivante), qui n'a **jamais tourné en réel**. L'ancien modèle ≤ 2026 et le nouveau cohabitent dans le même module : c'est le terrain idéal pour une régression silencieuse.
3. Le seul filet actuel est `tsc` + des garde-fous dev `console.error` — qui ne s'exécutent que si on lance l'app en local *et* qu'on lit la console.

Une double réservation d'été ou une rotation fausse, c'est le seul type de bug de cette app qui provoque une vraie dispute familiale. Le coût d'un test est sans commune mesure.

## Objectif

Un filet de sécurité **proportionné** : tests unitaires sur `lib/` uniquement, une CI qui les exécute avec typecheck et lint à chaque push. **Pas de tests UI, pas d'E2E, pas de coverage cible** — à 14 users, c'est du théâtre.

## Périmètre des tests (par priorité)

### P0 — la logique été (le cœur du risque)

`lib/summer-priorities.ts` :
- Rotation ancrée 2024 (Antoine → Vincent → François), `getYearPriorities` correcte pour 2024…2030 (table de vérité explicite, modulo 3).
- `getPeriodDates` **modèle ≤ 2026** (ancien découpage) vs **modèle pivot 2027+** : bornes exactes des 3 périodes pour 2026 ET 2027, chevauchement au jour pivot (dernier jour P1 = premier jour P2), années non configurées (`isSummerYearConfigured`).
- `overlapsSummerPeriod` : bornes incluses/excluses, séjour à cheval sur un pivot.
- `getRelevantSummerYear` : bascule d'année (un 1er septembre → été N+1 ? figer la règle actuelle dans un test).

`lib/summer-placeholders.ts` : génération des placeholders par année/priorité, cohérence avec `getPeriodDates`.

### P1 — dates et données marées

`lib/dates.ts` :
- `parseLocalDate` vs `new Date(iso)` : le test qui **verrouille le bug timezone historique** (un séjour ne doit jamais se décaler d'un jour en heure d'hiver Paris).
- `daysBetween`, `daysInRangeClipped`, `nightsInRangeClipped` (bornes, ranges dégénérés), `addDays` (passage de mois/année), `todayInParis` (mock de `Date`).

`lib/tides.ts` / `lib/tides-times.ts` :
- Indexation **par position** de `RAW_BY_YEAR` : longueurs de mois exactes pour chaque année committée, y compris bissextiles — promouvoir le garde-fou dev `console.error` en assertion de test.
- `tideLevel` : bornes des paliers.
- `getOfflineTides` : jour couvert / non couvert / dernier jour de l'année (lendemain absent), horaires croissants sur toute l'année, cohérence coef PM ↔ nombre de PM du jour.

### P2 — le reste de `lib/`

- `lib/db-errors.ts` : mapping SQLSTATE `23505`/`23P01` → messages FR par contexte, erreur inconnue → message générique.
- `lib/validation/` : règles de dates de réservation (60 j max, début ≥ demain, fin ≥ début).
- `lib/families.ts`, `lib/holidays.ts`, `lib/garbage-collection.ts`, la partie pure de `lib/conditions.ts` (phrase de tendance semaine : déterministe par règles → table entrées/sorties).

**Hors périmètre** : composants React, pages, server actions, `lib/data/*` (I/O Supabase — la logique DB est déjà défendue par les contraintes SQL des migrations 0007/0008, qui sont le bon niveau d'enforcement).

## Outillage

- **Vitest** (pas Jest) : natif TS/ESM, zéro config avec le `tsconfig` existant, dépendance dev unique.
- Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`.
- Convention : tests colocalisés `lib/foo.test.ts` (près du code, cohérent avec la taille du projet).
- Mock du temps : `vi.setSystemTime` pour `todayInParis` / `getRelevantSummerYear` — jamais de dépendance à l'horloge réelle dans un test.

## CI — GitHub Actions minimale

`.github/workflows/ci.yml` :

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm test
```

Pas de build Next dans la CI (Vercel le fait déjà à chaque push), pas de secrets requis (les tests sont purs). Durée attendue < 2 min.

## Critères de fait

- [ ] `npm test` vert en local, < 10 s.
- [ ] Table de vérité rotation 2024–2030 + bornes P1/P2/P3 pour 2026 **et** 2027 (pivot) verrouillées.
- [ ] Le test timezone `parseLocalDate` existe et échoue si on le remplace par `new Date(iso)`.
- [ ] Les garde-fous dev de `tides.ts` / `tides-times.ts` existent aussi en tests.
- [ ] CI verte sur `master`, badge optionnel dans le README.
