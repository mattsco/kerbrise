# Spec — Warnings « ponts du printemps » (#38)

> **Statut** : ✅ Spécifiée, tous points tranchés — prête à implémenter (20 juillet 2026)
> **Type** : Feature moyenne, purement advisory (aucun blocage)
> **Cible** : avant la saison des choix de ponts 2027 (janvier–février 2027)
> **Estimation** : ~2-3h + tests lib
> **Dernière MAJ** : 20 juillet 2026

## Objectif

Donner de la visibilité à la règle des ponts du printemps, aujourd'hui purement
textuelle (`a-propos/regles`) :

> Les week-ends prolongés (Ascension, Pentecôte, etc.) sont partagés
> équitablement. La famille en priorité 3 l'été est en priorité 1 pour choisir
> son pont préféré du printemps suivant.

On ne **bloque rien** (décision PO existante, cf. `priority-card-profil.md` :
« le calendrier reste flexible, pas d'enforcement »). On affiche des
**warnings contextuels** aux deux moments où la règle peut jouer :

1. **À la création d'une demande** qui chevauche un pont (NewBookingForm) —
   « tu n'es pas prioritaire et la famille prioritaire n'a pas encore choisi »,
   ou « ta famille a déjà un pont ce printemps ».
2. **À la validation** (BookingDetailModal) — les 2 familles qui valident voient
   le même contexte. C'est le vrai levier : le mécanisme d'enforcement existant
   de Kerbrise, c'est la validation croisée, pas le code.

## Définition opérationnelle d'un « pont »

Rien dans le code ne modélise un pont aujourd'hui (`lib/holidays.ts` connaît
les jours fériés, pas les week-ends prolongés). À construire :

**Fériés concernés — les « ponts de mai » uniquement (tranché 20 juil. 2026)** :
1er Mai, 8 Mai, Ascension, Lundi de Pentecôte. **Pâques est exclu** du
périmètre. On identifie les fériés par leur nom (pas par une fenêtre de
dates) : Ascension/Pentecôte peuvent déborder sur début juin certaines années,
ils restent inclus.

**Fenêtre du pont selon le jour de semaine du férié** :

| Férié tombe un | Fenêtre du pont | Exemple |
|---|---|---|
| Jeudi | jeudi → dimanche (4j) | Ascension, toujours |
| Vendredi | vendredi → dimanche (3j) | 1er/8 mai certains ans |
| Lundi | samedi → lundi (3j) | Pâques, Pentecôte, toujours |
| Mardi | samedi → mardi (4j) | 1er/8 mai certains ans |
| Mercredi / samedi / dimanche | **pas de pont** | 1er mai 2027 = samedi |

Exemple 2027 : deux ponts — **Ascension (jeu 6 → dim 9 mai)** et
**Pentecôte (sam 15 → lun 17 mai)**. Le 1er et le 8 mai tombent un samedi,
pas de pont.

**Cas limite** : si deux fenêtres se chevauchent (rare : Ascension proche du
8 mai selon l'année), on fusionne en un seul pont à double nom.

**« Prendre un pont » (tranché 20 juil. 2026)** : un séjour prend un pont s'il
couvre au moins une **nuit** du pont — intersection non vide entre les nuits
du séjour (`start` → `end − 1`) et celles du pont (`pStart` → `pEnd − 1`).
**Les jours pivots sont autorisés** : partir le premier jour du pont ou
arriver le dernier jour ne prend aucune nuit, donc pas de warning (ex. pont
sam→lun de Pentecôte : je pars le samedi, ou j'arrive le lundi → François a
toujours son long week-end). En revanche arriver le dimanche d'un pont
sam→lun prend la nuit dim→lun → ça compte.

## ✅ Quelle année ? — tranché : la même année (20 juil. 2026)

La compensation joue **dans la même année calendaire** : la famille en
priorité 3 de l'été Y est prioritaire sur les **ponts de mai Y** (elle connaît
sa priorité été dès janvier Y, la compensation arrive avant l'été subi).
Exemple 2027 : Antoine P1, Vincent P2, **François P3 → François prioritaire
sur les ponts de mai 2027**.

C'est ce que `PriorityCard.tsx:44` implémente déjà (`priorities[3]` de l'année
pertinente) — la carte est correcte. Le libellé du règlement (« son pont
préféré du printemps *suivant* ») n'est pas faux, il est écrit du point de vue
de la **saison des réservations** (déc–fév) : à ce moment-là, « le printemps
suivant » est celui qui arrive, même année que l'été concerné. Hors de ce
contexte il se lit comme Y+1. **Inclus dans ce chantier** : reformuler la
section 🌸 de `a-propos/regles/page.tsx` pour lever l'ambiguïté, ex. « La
famille en priorité 3 l'été est en priorité 1 pour choisir son pont de mai de
la même année. »

Implémentation : extraire un helper unique `getPontPriorityFamily(year)`
(= `getYearPriorities(year)[3]`) consommé par la carte ET par les warnings,
pour que la règle ne vive qu'à un seul endroit.

## Warnings — les 3 cas

Tous **non bloquants** : le bouton « Envoyer la demande » reste actif
(contrairement au blocage été `summerConflict`). Encart ambre, même style que
l'encart période d'été existant.

**Cas A — pas prioritaire, et la famille prioritaire n'a pas encore son pont**
(ex. 2027 vu par Vincent, P2) :

> 🌸 Ces dates couvrent le **pont de l'Ascension** (6–9 mai). Cette année
> c'est **François** qui choisit son pont en premier (compensation de sa
> priorité 3 cet été) et il n'a pas encore choisi. Ta demande reste
> possible — elle sera soumise à validation comme d'habitude.

**Extinction (tranché 20 juil. 2026)** : le warning disparaît dès que la
famille prioritaire (P3) a son **premier** pont de mai **approved**. Sa
priorité est alors consommée pour l'année ; les ponts restants sont libres
(seul le cas B — équité — peut encore s'afficher). Une demande **pending** de
la P3 n'éteint pas le warning mais est mentionnée dedans (« François a
demandé le pont de Pentecôte, en attente de validation »).

**Cas B — deuxième pont alors qu'une famille n'en a aucun** :

> ⚖️ Ta famille a déjà le **pont de Pentecôte** ce printemps. Les ponts sont
> partagés équitablement — **Antoine** n'en a encore aucun.

Déclenché si : ma famille a déjà ≥1 pont ce printemps ET ≥1 autre famille
n'en a aucun. (Si tout le monde est servi, reprendre un pont est libre.)

**Cas C — info positive, famille prioritaire** :

> 🌸 Tu es prioritaire pour choisir ton pont ce printemps — c'est ton tour.

Les cas peuvent se cumuler (A+B : pas prioritaire ET déjà un pont).

## Côté validateurs (le vrai enforcement)

Dans `BookingDetailModal`, quand une demande **pending** chevauche un pont,
afficher aux validateurs un encart contextuel :

> 🌸 Ce séjour couvre le **pont de l'Ascension**. Prioritaire ce printemps :
> **François** (n'a pas encore choisi son pont). Ponts déjà pris : Pentecôte
> → Vincent.

Aucune recommandation d'accepter/refuser — juste les faits, la famille décide.

## Architecture pressentie

```
lib/ponts.ts                  ← NOUVEAU, logique pure + testée (esprit #34)
  getMayPonts(year): Pont[]              // depuis getHolidaysForYear
  getPontsForRange(start, end): Pont[]   // quels ponts un séjour chevauche
  getPontPriorityFamily(year)            // = getYearPriorities(year)[3]

lib/data/bookings.ts (ou lib/ponts-state.ts)
  getMayPontsSnapshot(year)     ← 1 requête : bookings pending+approved qui
                                  chevauchent les fenêtres de ponts de l'année
                                  → { pont → familles, famille → nb ponts }

components/PontAdvisory.tsx    ← encart réutilisé par NewBookingForm (cas A/B/C)
                                 et BookingDetailModal (vue validateur)

components/profil/PriorityCard.tsx ← refactor : consomme getPontPriorityFamily
```

- `lib/ponts.ts` est du calcul pur sur `date-holidays` (déjà en dépendance) :
  testable sans DB, couvre les années arbitraires — pas de problème de config
  d'année contrairement à l'été (`SUMMER_PERIOD_1_START`).
- Le snapshot suit le pattern de `getSummerSnapshot` mais reste plus simple :
  pas de tour-par-tour strict, pas d'auto-assignment.
- Dans NewBookingForm, le fetch du snapshot s'ajoute au `useEffect` existant
  qui charge déjà `getRelatedBookings` quand les dates changent.

## Décisions (actées 20 juil. 2026)

- **Non bloquant partout.** Cohérent avec la décision PO actée dans
  `priority-card-profil.md`. Seul l'été bloque, car seul l'été a des périodes
  canoniques et un tour-par-tour codé.
- **Seul un séjour approved compte comme « pont pris »** (extinction du cas A,
  compteurs d'équité du cas B). Une demande pending ne consomme rien mais est
  affichée à titre informatif (« demandé, en attente ») dans les encarts —
  demandeur comme validateurs.
- **Pas de tour-par-tour complet** : la règle ne définit que la priorité 1
  (compensation P3 été). Les priorités 2/3 des ponts n'existent pas dans le
  règlement — le « partage équitable » (cas B) suffit. On ne les invente pas.
- **Ponts de mai uniquement** (1er/8 mai, Ascension, Pentecôte). Pâques exclu,
  ponts d'automne (Toussaint, 11 novembre) hors périmètre — le règlement
  familial ne couvre que les ponts de mai. Généralisable plus tard si la
  famille étend la règle.
- **Pas d'email dédié** en v1. Si le weekly digest (item sept-oct roadmap)
  gagne un producteur « pont non choisi », ce sera une extension naturelle,
  pas ce chantier.

## Cas limites

- **Séjour couvrant 2 ponts** (ex. 1er mai → Pentecôte) : compte comme 2 ponts
  pris ; cas B s'applique dès la demande si une famille n'a rien.
- **Année sans pont exploitable** (1er/8 mai en mercredi/week-end) : il reste
  toujours au moins l'Ascension (jeudi) et la Pentecôte (lundi), à jour de
  semaine fixe. La logique liste simplement ce qui existe.
- **Ascension ou Pentecôte début juin** (années à Pâques tardif) : incluses
  quand même — le périmètre est défini par les 4 fériés, pas par le mois.
- **Séjour d'une famille sur un pont déjà pris par elle-même** (prolongation) :
  pas de nouveau warning B si ça reste le même pont.

## Points ouverts — tous tranchés (20 juillet 2026)

- ~~Chevauchement ≥1 jour = prendre le pont ?~~ → **Non : au moins une nuit.**
  Les jours pivots (partir le premier jour, arriver le dernier) sont autorisés
  sans warning (cf. définition ci-dessus).
- ~~Fenêtre d'activation du cas A~~ → **Toute l'année, sans limite
  d'horizon** : une résa faite dès aujourd'hui sur un pont de mai 2028
  déclenche le contexte des ponts 2028 (prioritaire = P3 de l'été 2028).
  `lib/ponts.ts` étant pur et sans config d'année, ça ne coûte rien.
- ~~Pending = pont pris ?~~ → **Non, seul approved compte** (cf. Décisions).

## Liens

- Règlement source : `app/dashboard/a-propos/regles/page.tsx` (section 🌸)
- Carte profil (à refactorer) : `components/profil/PriorityCard.tsx`
- Spec sœur avec la décision « pas d'enforcement » : `docs/specs/priority-card-profil.md`
- Fériés : `lib/holidays.ts` (`date-holidays`, déjà testé par `lib/holidays.test.ts`)
- Pattern snapshot : `lib/summer-state.ts` (`getSummerSnapshot`)
