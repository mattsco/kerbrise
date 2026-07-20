# Spec — Warnings « quinzaines de juin / septembre » (#39)

> **Statut** : 📋 Proposée — 20 juillet 2026
> **Type** : Feature petite/moyenne, advisory (aucun blocage)
> **S'appuie sur** : #38, **livré** (commit `2f8c51e`) — même patron, mêmes surfaces
> **Estimation** : ~1h30-2h (moins que #38 : pas de calcul de fériés)
> **Dernière MAJ** : 20 juillet 2026

## Objectif

Rendre actionnable la dernière règle du règlement encore purement textuelle :

> 🌷 **Juin et septembre** — Partagés par tranches de 2 semaines. La famille qui
> occupe la **Période 1** (début juillet) n'est pas prioritaire pour la deuxième
> quinzaine de juin. Idem, la famille qui occupe la **Période 3** (fin août)
> n'est pas prioritaire pour la première quinzaine de septembre.

Intention de la règle : **empêcher qu'une famille monopolise une longue plage
continue** en enchaînant juin→juillet (5 semaines d'affilée) ou août→septembre.

La `PriorityCard` du profil énonce déjà la contrainte de façon passive
(`PriorityCard.tsx:73-93`). Ce chantier l'amène **au moment où elle compte** :
quand la famille concernée saisit précisément ces dates.

## Ce que la règle dit — et ne dit pas

⚠️ Asymétrie structurante, à ne pas dépasser : la règle désigne uniquement qui
n'est **PAS** prioritaire. Elle **ne désigne aucune famille prioritaire** sur
ces quinzaines, et ne définit **aucun ordre de choix**.

Conséquence directe sur le wording : on peut écrire « tu n'es pas prioritaire
sur ces dates », **jamais** « attends que X ait choisi » ni « X est
prioritaire ». C'est la différence avec les ponts de mai (#38), où le règlement
nomme explicitement une priorité 1.

On n'invente pas non plus de rotation pour le « partagés par tranches de
2 semaines » : le découpage en quinzaines existe, l'ordre d'attribution non.
Le levier reste la validation croisée par les 2 autres familles.

## Définition des fenêtres

**Ancrage sur les périodes réelles, pas sur le calendrier** (recommandation) :

- Fenêtre « juin » = les **14 jours précédant le début de P1**
- Fenêtre « septembre » = les **14 jours suivant la fin de P3**

Le règlement dit « deuxième quinzaine de juin » / « première quinzaine de
septembre », ce qui suppose des périodes d'été à dates fixes. Depuis le modèle
pivot (≥2027, `SUMMER_PERIOD_1_START`), **le début de P1 est voté chaque
année** : une quinzaine calendaire figée raterait l'intention dès que P1 bouge.
L'ancrage relatif suit automatiquement et reste très proche du texte :

| Année | Début P1 | Fenêtre juin | Fin P3 | Fenêtre septembre |
|---|---|---|---|---|
| 2026 (legacy) | 29 juin | 15 → 29 juin | 31 août | 1 → 15 sept. |
| 2027 | 28 juin | 14 → 28 juin | 30 août | 30 août → 13 sept. |
| 2028 | 1 juillet | 17 juin → 1 juillet | 2 sept. | 2 → 16 sept. |
| 2029 | 30 juin | 16 → 30 juin | 1 sept. | 1 → 15 sept. |

L'écart avec la quinzaine calendaire ne dépasse jamais quelques jours, et la
contiguïté avec la période d'été — le vrai sujet — est exacte par construction.

**« Réserver dans la fenêtre »** : même convention qu'en #38 — le séjour doit
couvrir **au moins une nuit** de la fenêtre. Jours pivots autorisés : arriver
pile le jour de début de P1 (donc après la fenêtre juin) ne déclenche rien.

## Quand le warning s'affiche

**Gating par période, pas sur les 3 périodes attribuées** (correction proposée
au périmètre initial) :

- Warning juin → dès que **P1 est attribuée**, à la famille qui la détient.
- Warning septembre → dès que **P3 est attribuée**, à la famille qui la détient.

Raison : dès qu'Antoine a pris P1, la contrainte « Antoine n'est pas
prioritaire fin juin » est **entièrement déterminée** — l'état de P2 et P3 n'y
change rien. Attendre 3/3 créerait un trou pile pendant la fenêtre où les gens
réservent : la P1 pique sa période en janvier, les autres suivent parfois des
semaines plus tard, et pendant tout cet intervalle un membre d'Antoine
réserverait fin juin sans rien voir.

Bonus : c'est exactement le gating déjà utilisé par `PriorityCard`
(une ligne par période choisie) — les deux surfaces resteront cohérentes.

La P2 n'a **aucune contrainte** : aucun warning ne la concerne jamais.

## Le warning

Non bloquant, encart ambre, bouton « Envoyer la demande » actif — identique à
#38. Déclenché quand la famille de l'utilisateur détient P1 (resp. P3) et que
les dates saisies mordent la fenêtre correspondante.

**Cas juin** (famille Antoine, détentrice de P1 2027) :

> 🌷 Ta famille occupe la **Période 1** (28 juin → 19 juillet). Ces dates
> couvrent les **2 semaines qui précèdent** ta période : tu n'es pas
> prioritaire dessus, pour éviter d'enchaîner 5 semaines d'affilée. Ta demande
> reste possible — elle sera soumise à validation comme d'habitude.

**Cas septembre** (famille détentrice de P3) :

> 🌷 Ta famille occupe la **Période 3** (jusqu'au 30 août). Ces dates couvrent
> les **2 semaines qui suivent** ta période : tu n'es pas prioritaire dessus.
> Ta demande reste possible — elle sera soumise à validation comme d'habitude.

Aucune mention d'une famille prioritaire (cf. asymétrie ci-dessus).

## Côté validateurs

Même principe qu'en #38, dans `BookingDetailModal`, pour une demande pending :

> 🌷 Ce séjour couvre les 2 semaines précédant la **Période 1**, occupée par
> **Antoine** — qui n'est pas prioritaire sur cette quinzaine.

Factuel, sans recommandation. C'est là que la règle a réellement des dents.

## Architecture

Décalque exact du patron posé par #38 (`lib/ponts.ts` + `lib/ponts-state.ts` +
`components/PontAdvisory.tsx`) : logique pure testée d'un côté, calcul de
l'advisory renvoyant un objet typé, composant d'affichage bête de l'autre.

```
lib/summer-adjacent.ts            ← NOUVEAU, 100 % pur + testé
  getPreSummerWindow(year)        // 14 j avant le début de P1
  getPostSummerWindow(year)       // 14 j après la fin de P3
  stayTakesWindow(start, end, w)  // ≥ 1 nuit, jours pivots autorisés
  computeDemanderAdjacentAdvisory(start, end, familyName, snapshot)
  computeValidatorAdjacentAdvisory(start, end, snapshot)

components/AdvisoryCard.tsx       ← extraction du shell ambre partagé
                                    (aujourd'hui `cardClass` en dur dans
                                    PontAdvisory.tsx:22)
components/SummerAdjacentAdvisory.tsx  ← ...Form / ...Validator, comme #38
```

- **Ne pas fusionner avec `PontAdvisory`** : ses props et sa copie sont
  spécifiques aux ponts (cas A/B/C, famille prioritaire). Le seul vrai
  partage est le shell visuel → extraire `AdvisoryCard` et laisser deux
  composants voisins. Les deux encarts peuvent d'ailleurs s'afficher en même
  temps (Pentecôte tardive ≈ fenêtre juin : théoriquement possible, cf. cas
  limites).
- **Aucun `-state.ts` à écrire** : `getSummerSnapshot(year)` donne déjà les
  détenteurs de P1 et P3. Un round-trip dans `NewBookingForm`, zéro dans
  `BookingDetailModal` si le snapshot y est déjà chargé.
- **Même optimisation lazy qu'en #38** (`NewBookingForm.tsx:72-73`) : les
  fenêtres sont du calcul **100 % pur** (`getPeriodDates` + `addDays`, aucune
  DB) → on ne déclenche la requête snapshot que si les dates saisies mordent
  effectivement une fenêtre. Cas courant = zéro requête ajoutée.
- ⚠️ `getPeriodDates` **lève** pour une année ≥2027 non votée : passer par
  `isSummerYearConfigured(year)` avant, et ne rien afficher sinon (même
  précaution que le reste de l'app).

## Décisions

- **Non bloquant**, comme #38 et conformément à la décision PO de
  `priority-card-profil.md` (« le calendrier reste flexible »).
- **Seul un séjour approved** rend une période « attribuée » pour le gating,
  cohérent avec #38.
- **Jamais de désignation d'un prioritaire** sur ces quinzaines : la règle ne
  le permet pas.
- **Pas de rotation juin/septembre inventée.** Si la famille veut un vrai
  tour-par-tour sur les quinzaines, c'est une modification du règlement à
  voter, pas une inférence du code.

## Cas limites

- **⚠️ Piège hérité du matching exact** : `getSummerSnapshot` ne reconnaît une
  période comme prise que si un booking colle **pile** aux dates canoniques
  (`summer-state.ts:54`, documenté dans `priority-card-profil.md`). Une
  réservation P1 saisie 29 juin → 20 juillet au lieu du canonique laisse la
  période « free » → **aucun warning ne se déclenchera jamais** cette
  année-là. Silencieux et invisible. À vérifier au moins une fois par saison,
  ou à traiter par une vraie tolérance « ≈ Période X » dans `getSummerSnapshot`
  (choix structurant, hors périmètre ici).
- **Chevauchement direct de la période d'été** : déjà **durement bloqué** en
  amont par `overlapsSummerPeriod` dans `NewBookingForm`. Un séjour
  15 juin → 5 juillet ne verra donc jamais ce warning — il est refusé avant.
  L'advisory couvre exactement le cas visé : *je m'arrête pile au début de ma
  période* (l'enchaînement 5 semaines).
- **Séjour à cheval sur les deux fenêtres** : impossible, elles sont séparées
  par les 9 semaines d'été.
- **Collision avec un pont de mai (#38)** : rare mais réelle. La Pentecôte peut
  tomber jusqu'à la mi-juin (Pâques au plus tard le 25 avril), soit à la limite
  basse de la fenêtre juin. Les deux encarts s'afficheraient alors ensemble —
  c'est acceptable (deux règles distinctes, deux messages), à condition de ne
  pas les fusionner en un composant unique.
- **Famille détenant P1 et P3** : impossible (une période par famille).
- **Années non configurées** (≥2027 sans date votée) : aucun warning.

## Points ouverts

1. **14 jours ou « jusqu'au 15 du mois » ?** La spec propose 14 jours ancrés
   sur la période. Si la famille tient au découpage calendaire strict
   (1-15 / 16-30), c'est un one-liner à changer — mais l'ancrage relatif tient
   mieux la route avec le modèle pivot.
2. **Étendre au symétrique manquant ?** La règle ne dit rien de la 1re
   quinzaine de juin ni de la 2e de septembre. Volontaire, on n'y touche pas.

## Liens

- Règlement source : `app/dashboard/a-propos/regles/page.tsx` (section 🌷)
- Énoncé passif déjà en place : `components/profil/PriorityCard.tsx:73-93`
- Spec sœur (ponts de mai) : `docs/specs/ponts-printemps-warnings.md`
- Snapshot été : `lib/summer-state.ts`
- Piège du matching exact : `docs/specs/priority-card-profil.md` (§ Notes d'implémentation)
