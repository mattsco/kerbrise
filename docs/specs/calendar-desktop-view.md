# Spec — CalendarDesktopView (#31)

> **Statut** : ✅ Implémentée
> **Cible** : Release 1.2.0
> **Dernière MAJ** : 14 juin 2026 (ajout doc Vue Marées V2)

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

## Points ouverts — tranchés à l'implémentation (10 juin 2026)

- **Densité des cells** : 22px/ligne (≈735px de haut avec l'en-tête mois).
  La grille porte `min-w-[1100px]` ; en dessous (iPad portrait à 768px
  inclus), scroll horizontal via le conteneur `overflow-x-auto`.
- **Séjours à cheval sur 2 mois** : barre **coupée à la colonne**,
  étiquette non répétée sur le second mois — comportement exact du
  tableur Excel historique. Le tooltip et le clic donnent l'identité.
- **Jours 29-31 inexistants** : cellule **grisée vide** (`bg-slate-50/80`),
  pas masquée — l'alignement vertical type tableur est préservé.
- **Week-ends / fériés** : **oui** (preuve : le tableur de Vincent les
  marque). Samedi `slate-100`, dimanche `slate-200/70`, férié = numéro
  rouge + nom court affiché si le jour est libre. Chaque cellule porte
  aussi la lettre du jour (L M M J V S D) comme l'Excel.

## Décisions d'implémentation hors spec

- **Placeholders été ajoutés à la vue desktop** : absents de la spec,
  mais les omettre aurait été une régression vs mobile (un chef de
  famille sur PC n'aurait pas pu réserver P1/P2/P3). Même rendu dashed
  + clic → `SummerPlaceholderModal`.
- **Aucune nouvelle query** : la spec supposait "fetch toute l'année" ;
  en réalité `getCalendarBookings()` est déjà non borné. La navigation
  d'année est un pur filtre d'affichage. (Si le volume grossit dans
  quelques années, borner la query sera un chantier commun aux 2 vues.)
- **`Calendar.tsx` reste dans `components/`** (pas déplacé dans
  `calendar/` comme le schéma de la spec) : il devient le cerveau
  partagé (sélection, modals, maps dérivées) + dispatch CSS
  `md:hidden` / `hidden md:block`. La vue mobile est extraite telle
  quelle dans `calendar/CalendarMobileView.tsx`.
- **Bannière contextuelle** : réutilise la *fonction*
  `computeBannerContext` (données approuvées uniquement), pas le
  composant dashboard (pas de `displayName` ici). Cas C rendu `null` :
  le block "Mes prochains séjours" couvre déjà ce cas. Cas D : bouton
  qui ouvre le `NewBookingModal` (pas un lien).
- **Échap** annule la sélection en cours (desktop uniquement).
- **`+ Nouvelle demande`** ouvre le `NewBookingModal` sans dates
  préremplies (champs vides acceptés par `NewBookingForm`).
- **Filtre famille** : toggle simple, les autres familles passent à
  opacité 0.12 (elles restent cliquables pour les détails).
- **`FRENCH_MONTHS`** déplacé dans `calendar/calendar-utils.ts`
  (source unique mobile + desktop).

## Ajout post-v1 : stats d'occupation (10 juin 2026)

Le planning Excel affichait sous le calendrier un bloc « Nombre de
journées / Taux d'occupation » par famille. Reproduit dans
`desktop/YearOccupancyStats.tsx`, rendu sous la grille :

- **Conventions = page Stats** (cohérence inter-pages) : séjours
  approuvés uniquement, comptage inclusif, clippé à l'année affichée
  (séjours à cheval sur 2 années). Un jour pivot compte pour les
  2 familles — biais identique à `/stats`, assumé.
- **% par famille** = part du total occupé (convention Excel,
  ex. 45/143 = 31 %). **Ligne Total** = % de l'année
  (« 143 j · 39 % de l'année ») au lieu du « 100 % » du tableur.
- Réagit à la navigation d'année, **ignore le filtre famille**.
  Zéro query : calcul client sur les events déjà chargés. Masqué
  si l'année affichée n'a aucun séjour approuvé.
- La fonction de clipping locale à `stats/page.tsx` a été extraite
  vers `lib/dates.ts` (`daysInRangeClipped`) — source unique
  partagée par les deux pages.

## Ajout post-v1 : Vue Marées (V2, livrée v1.2.0)

La grille année peut être recolorée selon une **métrique** au choix, via un
sélecteur dans le sidepanel. Concrétise le « V2-ready » de l'architecture
(nouveau block sidepanel + recoloration de la grille, sans toucher au reste).

- **`SidepanelViewSwitcher`** (block « Vue ») : deux modes — `stays`
  (occupation par famille, défaut) et `tides` (coefficient de marée du jour).
  Le mode est un état porté par `CalendarDesktopView`.
- **Recoloration** : en mode `tides`, chaque cellule prend la couleur du palier
  de coefficient du jour (heatmap morte-eau clair → grande marée foncé). En mode
  `stays`, comportement V1 inchangé. `MonthColumn` ne calcule la marée
  (`getTideDay`) **que** si `view === "tides"` (le memo de cellule tient).
- **Légende sous la grille** : `TideLegend` (paliers de coefficient) remplace
  `YearOccupancyStats` à l'emplacement et au style identiques, pour une bascule
  sans saut visuel. Réagit à la navigation d'année.
- **Données** : `lib/tides.ts` — coefficients Saint-Malo **committés en statique**
  par année (2024-2027 à ce jour), forme `RAW_BY_YEAR[année][mois][jour]`.
  Indexation par **position** dans le mois (jour-1), avec garde-fou dev qui
  vérifie les longueurs de mois (gère les bissextiles). `tideLevel(coef)` mappe
  un coefficient à un palier ; `TIDE_YEARS` / `TIDE_SCALE` exposés pour la
  légende. Une année sans données affiche un message neutre dans la légende.
  → Ceci **tranche la question « source des données marées »** : fichier annuel
  committé, pas d'API externe.

## Liens

- Composant de création réutilisé : `components/NewBookingForm.tsx` / `NewBookingModal`
- Logique bannière : `lib/dashboard-banner.ts`
- Couleurs familles : `lib/families.ts`
- Données marées : `lib/tides.ts`
