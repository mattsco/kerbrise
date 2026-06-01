# Spec — Priority card explicative dans le Profil (#22d)

> **Statut** : ✅ Implémentée — 1er juin 2026
> **Type** : Feature moyenne, à forte valeur pédagogique
> **Cible** : Indépendante de #22b, peut être faite à tout moment
> **Estimation** : ~45 min - 1h
> **Dernière MAJ** : 1er juin 2026

## Objectif

Afficher dans la page **Profil** une vraie carte explicative qui dit à chaque membre, en langage clair, **ce que sa priorité de l'année implique concrètement** : pour l'été, mais aussi pour les ponts de printemps et les quinzaines de juin/septembre.

Aujourd'hui le règlement (`a-propos/regles`) décrit les règles de façon générale et statique. Cette carte les **personnalise** pour l'utilisateur et son année.

## Rappel des règles métier (depuis le règlement)

### Rotation été
3 périodes d'été, 3 familles, rotation annuelle des priorités (1, 2, 3). La famille en priorité 1 choisit en premier, etc. La priorité 3 récupère automatiquement la dernière période (cf #22a déjà implémenté).

### 🌸 Ponts du printemps
Les week-ends prolongés (Ascension, Pentecôte, etc.) sont partagés équitablement.
**Règle clé** : la famille en **priorité 3 l'été** est en **priorité 1 pour choisir son pont préféré du printemps suivant**. (Compensation : tu passes en dernier pour l'été, mais en premier pour les ponts.)

### 🌷 Juin et septembre
Partagés par tranches de 2 semaines.
**Règle clé 1** : la famille qui occupe la **Période 1 (début juillet)** n'est **pas prioritaire pour la deuxième quinzaine de juin**.
**Règle clé 2** : la famille qui occupe la **Période 3 (fin août)** n'est **pas prioritaire pour la première quinzaine de septembre**.
(Logique : on évite qu'une famille monopolise une longue plage continue en enchaînant juin→juillet ou août→septembre.)

## Comportement attendu de la carte

La carte s'adapte selon :
1. La **priorité de l'utilisateur pour l'année concernée** (1, 2 ou 3)
2. Le fait que **sa période d'été soit déjà choisie ou non**
3. La **date courante** (avant/après le 1er octobre → voir section bascule)

### Exemple 1 — Utilisateur en priorité 3

> **Cette année vous êtes en priorité 3.**
> Vous devez attendre que Vincent et François choisissent leur période d'été avant de connaître la vôtre.
> En revanche, vous avez la **priorité pour choisir le pont de mai**.

Si la période d'été est déjà choisie, on ajoute :

> Vous avez la période d'été **début juillet**, donc vous n'avez pas la priorité sur les **2 dernières semaines de juin**.

### Exemple 2 — Utilisateur en priorité 1

> **Cette année vous êtes en priorité 1.**
> Vous pouvez choisir en premier votre période pour l'été.
> En revanche, **Vincent a la priorité** pour choisir son pont de mai.

Si la période d'été est déjà choisie, on ajoute :

> Vous avez choisi la période **fin août**, donc vous n'avez pas la priorité sur les **2 premières semaines de septembre**.

## Logique de bascule d'année (important)

La carte doit montrer la priorité **pertinente** au moment où on la consulte :

- **Avant le 1er octobre** → on montre la priorité de **l'année en cours** (le cycle été de cette année)
- **À partir du 1er octobre** → on montre la priorité de **l'année suivante** (on prépare le prochain été, les choix se font dès janvier)

> Raison : les choix d'été de l'année N se font en janvier N. Donc dès l'automne N-1, ce qui intéresse les familles c'est leur priorité pour l'été à venir.

## Logique conditionnelle à implémenter

Pseudo-code de ce que la carte doit calculer :

```
année_pertinente = (date_courante >= 1er octobre) ? année+1 : année
priorité = getYearPriorities(année_pertinente)[ma_famille]

// Bloc été
si priorité == 1 : "vous choisissez en premier"
si priorité == 2 : "vous choisissez après [famille prio 1]"
si priorité == 3 : "vous attendez [prio1] et [prio2], MAIS prio 1 sur le pont de printemps"

// Bloc pont de printemps
famille_prio_pont = famille qui était en priorité 3 l'été (= compensation)
si ma_famille == famille_prio_pont : "vous avez la priorité sur le pont de mai"
sinon : "[famille_prio_pont] a la priorité sur le pont"

// Bloc juin/septembre (seulement si période été déjà choisie)
si j'ai la Période 1 (début juillet) : "pas prioritaire sur la 2e quinzaine de juin"
si j'ai la Période 3 (fin août) : "pas prioritaire sur la 1re quinzaine de septembre"
si j'ai la Période 2 : (rien de spécial sur juin/sept)
```

## Architecture pressentie

```
components/profil/
└── PriorityCard.tsx           ← la carte, reçoit la famille + l'année pertinente

lib/summer-state.ts            ← réutiliser getSummerSnapshot pour savoir
                                 quelle période la famille a déjà choisie
lib/summer-priorities.ts       ← getYearPriorities pour l'ordre des priorités
```

La carte peut être un **server component** (pas d'interactivité) qui :
1. Calcule l'année pertinente (bascule 1er octobre)
2. Récupère la priorité de la famille via `getYearPriorities`
3. Récupère l'état des choix été via `getSummerSnapshot` (pour le bloc juin/sept conditionnel)
4. Rend le texte adapté

## Décisions

- **Pas d'enforcement** de ces règles dans le calendrier (le PO veut garder le calendrier flexible). La carte est purement **informative / pédagogique**.
- Les règles ponts/juin/septembre ne sont PAS codées comme contraintes ailleurs (cf décision : on ne code pas de contraintes dans le calendrier).

## Points ouverts — tranchés à l'implémentation (1er juin 2026)

- ~~Formulation exacte des textes~~ → **Tutoiement** retenu (cohérence avec le reste de la page Profil, qui dit "tu" ; les exemples ci-dessus étaient au vouvoiement). Textes juin/septembre calés sur le règlement ("2e quinzaine de juin", "1re quinzaine de septembre").
- ~~Lien "voir le règlement complet"~~ → **Oui**, ajouté en bas de la carte (préserve l'affordance de l'ancien encart "Priorité été" que la carte remplace).
- ~~Cas "double attente" (priorité 3 sans période choisie)~~ → Le bloc juin/septembre est simplement **masqué** tant qu'aucune période n'est choisie ; le bloc été dit déjà "tu choisis après X et Y", ce qui exprime l'attente. Pas de wording dédié.
- ~~Mini-récap visuel~~ → **Skippé** (simplicité). Facile à ajouter plus tard si besoin.

## Notes d'implémentation

- **Le composant prend uniquement `familyName`** en prop et calcule l'année pertinente lui-même (il ne la reçoit pas).
- **Bascule 1er octobre** : implémentée en modifiant le helper partagé `getRelevantSummerYear` (qui basculait au 31 août), pas en codant la date dans la carte → la page règles et le profil suivent automatiquement.
- **Bloc juin/septembre généralisé** : au lieu d'afficher la seule restriction de l'utilisateur, la carte montre **les deux** familles concernées (détenteur de la Période 1 → 2e quinzaine de juin ; détenteur de la Période 3 → 1re quinzaine de septembre). "Tu" pour sa propre famille, le nom pour l'autre. Chaque ligne apparaît dès que sa période est choisie.
- **⚠️ Gating sur dates exactes** : une période n'est vue comme "choisie" que si un booking colle **pile** aux dates canoniques (`getPeriodDates`, ex. P3 = 10→31 août), via `getSummerSnapshot`. Un séjour aux dates approchantes (ex. 10→30 août) n'est **pas** détecté, donc la ligne juin/sept ne s'affiche pas. Volontaire et cohérent avec la logique placeholder, mais à connaître : une vraie tolérance "≈ Période X" serait un choix à faire dans `getSummerSnapshot` (donc partout), pas dans la carte.
- **API réelle** : `getYearPriorities(year)` est indexé **priorité → famille** (≠ pseudo-code ci-dessus). On lit la priorité d'une famille avec `getFamilyPriority(year, famille)`, et le détenteur du pont avec `getYearPriorities(year)[3]`.

## Lien avec d'autres features

- Réutilise `lib/summer-state.ts` (`getSummerSnapshot`) et `lib/summer-priorities.ts` (`getYearPriorities`) — déjà créés lors de #22a.
- Complète le règlement statique de `a-propos/regles`.

## Liens

- Règlement source : `app/dashboard/a-propos/regles/page.tsx`
- État été : `lib/summer-state.ts`
- Priorités : `lib/summer-priorities.ts`
