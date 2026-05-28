# Spec — CalendarDesktopView (#31)

> **Statut** : 📋 Spec validée, pas encore implémentée
> **Cible** : Release 1.2.0 ou 1.3.0
> **Dernière MAJ** : 28 mai 2026

## Objectif

Offrir sur desktop une vue calendrier façon **tableur Google Sheets / Excel**, pour que les membres de la famille habitués à consulter l'ancien planning Excel retrouvent leurs repères. Sur mobile, on garde la vue actuelle (3 mois empilés verticalement).

## Décisions validées

### 1. Vue année entière

- **12 colonnes** (une par mois, janvier → décembre)
- Chaque colonne contient **31 cells verticales** (une par jour ; les jours 29/30/31 inexistants sont grisés/vides selon le mois)
- Navigation **par année** : `← 2025 · 2026 · 2027 →`
- Fetch de **toute l'année** en une query (vs 3 mois actuellement sur mobile)

### 2. Détection desktop/mobile

- **CSS responsive pur** via le breakpoint `md:` de Tailwind
- Pas de toggle manuel en V1

```tsx
<div className="block md:hidden">
  <CalendarMobileView ... />  {/* vue 3 mois actuelle */}
</div>
<div className="hidden md:block">
  <CalendarDesktopView ... />  {/* nouvelle vue année */}
</div>
```

- *(V2 éventuelle : toggle manuel + préférence stockée, si la famille le demande)*

### 3. UX de réservation

- L'utilisateur clique sur une **cell de début**, puis une **cell de fin**
- À la sélection complète → ouverture du **`NewBookingModal` existant** (on réutilise, pas de nouveau composant de création)
- Réutilise la logique de validation overlap déjà en place (bug #8)

### 4. Rendu des cells

- Au **premier jour d'un séjour** : texte `Antoine (14j)` (nom famille + durée)
- Les jours suivants du séjour : juste la **couleur de fond** de la famille
- Lecture visuelle type heatmap, comme l'ancien Excel familial
- Pas de texte répété sur chaque cell (trop dense)

### 5. Sidepanel gauche (V1 simplifié)

Blocks, du haut vers le bas :

1. **Légende des familles** (cliquable → filtre l'affichage par famille)
2. **Navigation année** (`← 2025 →`)
3. **Bouton "+ Nouvelle demande"** prominent
4. **Bannière contextuelle** (séjour actif / à venir, réutilise `computeBannerContext`)
5. **Mes prochains séjours** (liste compacte)

> ⚠️ **Pas** de navigation vers Demandes / Stats / Profil dans le sidepanel en V1. La vue desktop est "focused calendrier". Pour aller ailleurs, on reste sur l'accès actuel.

## Architecture (pensée V2-ready)

```
components/calendar/
├── Calendar.tsx                 ← logique partagée + dispatch mobile/desktop
├── (mobile actuel)
│   ├── MonthGrid.tsx
│   └── CalendarDayCell.tsx
└── desktop/
    ├── YearGrid.tsx             ← grille 12×31
    ├── MonthColumn.tsx          ← 1 colonne mois
    ├── DayCellDesktop.tsx       ← 1 cell jour (simple)
    └── Sidepanel/
        ├── index.tsx            ← orchestre les blocks
        ├── SidepanelFamilyLegend.tsx
        ├── SidepanelYearNav.tsx
        ├── SidepanelNewBookingButton.tsx
        ├── SidepanelContextBanner.tsx
        └── SidepanelMyStays.tsx
```

**Principe clé** : le sidepanel est une **somme de blocks indépendants**. La V2 ajoutera de nouveaux blocks (`SidepanelNav`, `SidepanelStatsPreview`, accès admin…) **sans toucher** aux blocks existants ni à la grille.

## Roadmap d'implémentation (estimation)

| Étape | Contenu | Effort |
|-------|---------|--------|
| 1 | `YearGrid` + `MonthColumn` + `DayCellDesktop` (rendu statique) | ~2h |
| 2 | Mapping des bookings sur la grille (couleurs + label) | ~1.5h |
| 3 | Sélection 2 clics + ouverture NewBookingModal | ~1.5h |
| 4 | Sidepanel + ses 5 blocks | ~2h |
| 5 | Filtres famille + nav année | ~1h |
| 6 | Polish responsive + tests | ~1h |

**Total estimé** : ~9h, à répartir sur plusieurs sessions.

## Points ouverts (à trancher à l'implémentation)

- Densité exacte des cells (hauteur en px) selon largeur d'écran cible
- Comportement des séjours qui chevauchent 2 mois (barre continue ou coupée à la colonne)
- Gestion des jours 29-31 sur février / mois courts (grisé vs masqué)
- Faut-il afficher les week-ends / jours fériés différemment comme sur mobile ?

## Liens

- Composant de création réutilisé : `components/NewBookingForm.tsx` / `NewBookingModal`
- Logique bannière : `lib/dashboard-banner.ts`
- Couleurs familles : `lib/families.ts`
