# Spec — Couverture des données offline : health check + rituel annuel (#33)

> **Statut** : 📋 Spec validée
> **Type** : Fiabilité / monitoring
> **Cible** : septembre–octobre 2026 — ⚠️ **échéance dure : 31/12/2026**
> **Estimation** : ~1h (check santé) + ~1-2h/an (rituel données)
> **Dernière MAJ** : 19 juillet 2026

## Problème

L'app repose sur des **données committées offline** — c'est un choix assumé (les sources temps-réel bloquent les IP datacenter, cf. `lib/tides-times.ts`), mais ces données **expirent** :

| Donnée | Fichier | Couverture | Expire |
|---|---|---|---|
| Horaires de marée (PM/BM + hauteurs) | `lib/data/tides-times-2026.ts` (via `lib/tides-times.ts`) | **2026 uniquement** | **31/12/2026** |
| Coefficients de marée | `lib/tides.ts` (`RAW_BY_YEAR`) | 2024–2027 | 31/12/2027 |
| Temp. mer (moyennes mensuelles) | `lib/sea-temp.ts` | 12 valeurs, sans année | jamais |
| Climato météo (normales mensuelles) | `lib/conditions.ts` | 12 valeurs, sans année | jamais |

Au **1er janvier 2027**, `getTideTimesDay()` renvoie `null` pour tous les jours → la bannière vacances, l'écran TRMNL du salon et le widget Garmin passent en mode dégradé (« Marée du jour » + coef, sans horaires). Et c'est le piège : **le repli est propre par design, donc la régression est silencieuse**. Personne ne verra d'erreur — juste une app qui s'appauvrit un matin de janvier.

Aujourd'hui, **rien ne surveille cette échéance**. La page `/admin/health` vérifie cron, triggers, vault… mais pas les données committées, qui sont pourtant la seule infrastructure de l'app qui se dégrade *toute seule, à date connue*.

## Objectif

Deux volets complémentaires :

1. **Un check « couverture données » dans `/admin/health`** qui rend l'échéance visible des mois à l'avance — la philosophie de la page : détecter la panne avant la famille.
2. **Un rituel annuel de réapprovisionnement** inscrit au roadmap (section sept–oct), au même titre que le checkpoint emails #28.

## Volet 1 — Check santé (~1h)

### Exposer la couverture depuis `lib/`

Les modules données exposent déjà leurs années (`TIDE_TIMES_YEARS`, `TIDE_YEARS`) mais pas de **date de fin de couverture**. Ajouter :

```ts
// lib/tides-times.ts
/** Dernier jour ISO couvert par les horaires committés (max des dates). */
export function tideTimesCoverageEnd(): string | null;

// lib/tides.ts
/** Dernier jour ISO couvert par les coefs ("<maxYear>-12-31"). */
export function tideCoefsCoverageEnd(): string;
```

Pour les horaires, calculer le **max réel des clés dates** (pas `"<année>-12-31"` en dur) : si une année est partiellement saisie un jour, le check le verra.

### Le check dans `health/actions.ts`

Un check `data-coverage` qui calcule `daysBetween(todayInParis(), coverageEnd)` pour chacune des deux sources :

| Jours restants | Statut | Message |
|---|---|---|
| > 60 j | `ok` | « Horaires marées couverts jusqu'au 31/12/2026 (165 j) » |
| 14–60 j | `warn` | « ⚠️ Horaires marées : plus que 42 j de couverture — générer l'année suivante (cf. rituel #33) » |
| < 14 j (ou dépassé) | `fail` | « ❌ Horaires marées expirés / expirent dans X j — bannière, TRMNL et Garmin en mode dégradé » |

Le seuil `warn` à 60 j fait sonner l'alarme **début novembre** pour une expiration au 31/12 — pile la fenêtre du rituel, et pile la période où l'admin regarde l'app (planification 2027).

Deux lignes distinctes (horaires / coefs) : elles n'expirent pas en même temps et ne se réapprovisionnent pas au même rythme.

### Pourquoi pas un cron / email

La page Health suffit : le weekly digest et le checkpoint #28 garantissent qu'un admin passe sur l'app en novembre. Pas de nouveau canal de notification pour un événement annuel à date connue. Si l'expérience montre que le warn passe inaperçu, on branchera une ligne dans le weekly digest (liste des « pendings actionnables », cf. roadmap sept–oct) — pas avant.

## Volet 2 — Rituel annuel (novembre, ~1-2h)

Checklist à dérouler chaque novembre (2026 : obligatoire ; ensuite : dès que le check passe warn) :

1. **Horaires N+1** : générer `lib/data/tides-times-<N+1>.ts` depuis la même source que 2026 (cf. en-tête de `tides-times.ts` ; scrape en local, jamais depuis Vercel), même format `Record<dateISO, TideTimeEvent[]>`. L'enregistrer dans `BY_YEAR` de `lib/tides-times.ts`.
2. **Coefs N+2** : ajouter l'année dans `RAW_BY_YEAR` de `lib/tides.ts` (garder ~2 ans d'avance, comme aujourd'hui 2027 est déjà là).
3. **Vérifier les garde-fous dev** (longueurs de mois dans `tides.ts`, horaires croissants dans `tides-times.ts`) : lancer `npm run dev` et lire la console.
4. **Croiser 3-4 jours de grande marée** avec maree.info à la main (coef, heures PM) — le même contrôle qualité que pour 2026.
5. Vérifier que le check Health repasse `ok`.

Les tests #34, s'ils existent, valident les points 3–4 automatiquement (cohérence coef PM ↔ horaires, format des heures).

## Hors périmètre

- Automatiser le scrape annuel (cron, edge function) : 1-2h/an ne justifie pas une automatisation fragile face à une source qui bloque les datacenters.
- Sea-temp et climato météo : tables sans année, elles n'expirent pas.
- `date-holidays` (fériés) : calculés par lib, pas de données committées.

## Critères de fait

- [ ] `/admin/health` affiche 2 lignes « couverture données » avec les jours restants.
- [ ] Le statut passe à `warn` sous 60 j, `fail` sous 14 j (testable en modifiant la date localement).
- [ ] Le rituel novembre est listé dans `ROADMAP.md` section sept–oct.
- [ ] (Déc. 2026) `tides-times-2027.ts` committé, check `ok`, bannière janvier vérifiée en preview avec date simulée.
