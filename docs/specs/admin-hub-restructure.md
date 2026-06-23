# Spec — Restructure du hub Admin (#30)

> **Statut** : ✅ Implémentée
> **Type** : Refactor / réorganisation UI
> **Cible** : Pas de date fixée
> **Estimation** : ~45 min - 1h
> **Dernière MAJ** : 24 juin 2026

## Problème

La page `/dashboard/admin` est devenue un placard fourre-tout : monitoring, simulation, opérations data, liens externes et product management sont tous empilés dans une seule page. Au fur et à mesure des ajouts, ça devient illisible.

## Objectif

Transformer `/dashboard/admin` en **vrai hub** : une page légère avec des cartes qui mènent à des **sous-pages thématiques**, sur le modèle de ce qui existe déjà avec Health / Analytics / Locations.

## Audit des fonctionnalités actuelles (5 familles)

1. **🩺 Monitoring** : Health, Analytics, Locations + stats rapides (users/séjours/pending) — *déjà en sous-pages*
2. **🧪 Simulation / Lab** : toggle family head, toggle calendar admin, simulate François/Vincent — *empilé dans la page*
3. **🛡️ Opérations data** : AdminBookingForm (ajout séjour mode admin) — *empilé dans la page*
4. **🔗 Liens externes** : Supabase, Vercel, Resend, Edge Functions + section "Mode email" — *empilé dans la page*
5. **📋 Product** : feature requests + roadmap + specs — *déjà en sous-page (`/admin/feature-requests`)*

## Structure cible

```
/dashboard/admin (hub léger : stats rapides + cartes)
├── /admin/health         ← existant
├── /admin/analytics      ← existant
├── /admin/locations      ← existant
├── /admin/lab            ← NOUVEAU : outils de simulation
│                           (toggleFamilyHead, toggleCalendarAdmin, simulateApprovals)
├── /admin/data           ← NOUVEAU : AdminBookingForm + futures opérations data
└── /admin/product        ← renommer /admin/feature-requests
                            (feature requests + roadmap + specs, déjà fait)
```

Les **liens externes** (Supabase, Vercel, Resend) passent en **footer discret** du hub, pas en grosse section.

La **section "Mode email"** (info sur EMAIL_TEST_MODE) → soit dans `/admin/lab`, soit elle disparaît une fois la migration emails (#28) faite (les modes seront dans `lib/config.ts`).

## Page hub repensée (mock)

```
🕵🏻‍♂️ Secret Admin Tools

[Stats rapides : 14 users · 23 séjours · 2 en attente]

──── cartes ────
[Health]  [Analytics]  [Locations]
[Lab]     [Data]       [Product •2]

──── footer discret ────
🔗 Supabase · Vercel · Resend · Edge Functions
```

## Détail des nouvelles sous-pages

### `/admin/lab`
Déplacer les 3 forms de simulation actuels :
- Toggle chef de famille
- Toggle mode admin calendrier
- Simuler approbation François / Vincent

### `/admin/data`
Déplacer `AdminBookingForm` (création de séjour en mode admin, sans email).
Réserver l'espace pour de futures opérations data (imports, resets, exports...).

## À faire aussi pendant ce refactor

- **Migrer les nouvelles pages vers `requireAuthUser`** dès leur création (cf #27 déjà fait sur `admin/actions.ts`)
- Garder le check `is_admin` / `is_calendar_admin` en tête de chaque sous-page (redirect si pas autorisé)
- Réutiliser le composant `BackButton` avec `href="/dashboard/admin"` pour revenir au hub

## Points ouverts

- Faut-il une sous-page `/admin/external` pour les liens, ou un simple footer suffit ? (footer recommandé)
- `/admin/feature-requests` → renommer en `/admin/product` ? (plus cohérent avec la carte "Product", mais casse l'URL existante — à faire proprement avec un redirect ou en renommant le dossier)
- Le "Mode email" : le garder où en attendant #28 ?

## Décisions

- On ne fait PAS ça en urgence — c'est du confort, pas une feature bloquante.
- "Don't boil the ocean" : la carte Product existe déjà et pointe sur `/admin/feature-requests`. Le reste de la restructure (Lab, Data, footer liens) peut se faire en une session dédiée quand l'envie est là.

## Lien avec d'autres features

- **#27** (migration requireAuthUser) : à appliquer aux nouvelles sous-pages.
- **#28** (migration emails) : fera disparaître la section "Mode email" du hub.
- **#25** (page config admin) : pourrait devenir une nouvelle sous-page `/admin/config` dans cette structure.

## Liens

- Page actuelle : `app/dashboard/admin/page.tsx`
- Actions : `app/dashboard/admin/actions.ts`
- Composant à déplacer : `components/AdminBookingForm.tsx`
