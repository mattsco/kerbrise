# Spec — Écran TRMNL « Film du jour en Bahasa »

> **Statut** : 🚧 Draft v0.1 — Q1→Q5 ouverts, archi arbitrée (in-app, cron + LLM, grounding TMDB)
> **Créée** : 18/06/2026 · **Cible** : à définir · **Backlog** : # à confirmer
> **Dépendances** : aucune bloquante. **Voisine** de `trmnl-sejour-display.md` (même device probable, mêmes conventions token/timezone/Liquid) — mais **délibérément découplée** (D1).
>
> **Objet** : un écran d'apprentissage personnel pour Matt. Chaque jour, un film de la liste TSPDT « Greatest Films of all time » (1000 titres) est tiré, son synopsis est réécrit en 3 lignes de **bahasa indonesia** qui tiennent sur l'e-ink, suivi de **3 mots de vocabulaire** à apprendre.

---

## 1. Contexte & objectif

Matt apprend le bahasa indonesia. Idée : transformer un coin d'e-ink en flashcard quotidienne contextualisée par le cinéma.

**Boucle visée** : 1×/jour, tirer un entier `N ∈ [1, 1000]` → récupérer le film de rang `N` dans la liste TSPDT GF1000 → produire un synopsis de **3 lignes en bahasa** (qui tiennent dans la largeur e-ink) → afficher **3 mots de vocabulaire** nouveaux avec leur traduction.

**Source** : `theyshootpictures.com/gf1000_all1000films_table.php`.
[Certain] Page rendue côté serveur (pas de JS), ~1000 lignes, format tabulaire : `rang | rang_préc | titre | réalisateur | année | pays | durée`. **Pas de synopsis dans la table** → le synopsis est **généré**, pas extrait (cf. D5).

**Garde-fou produit** : c'est une fonctionnalité **personnelle**, pas familiale. Elle ne doit pas s'entrelacer avec la logique « séjour » de Kerbrise (bookings, occupation, switch d'écran D16). Isolement strict dans `lib/bahasa/` + plugin/endpoint dédiés (D1).

**La vérité inconfortable à garder en tête** : pour les films classés ~700–1000 (cinéma mondial confidentiel), un synopsis « de mémoire » d'un LLM hallucine. Pour un outil d'apprentissage, mémoriser du vocabulaire rattaché à un film inventé est un échec silencieux. D'où le grounding obligatoire sur une source factuelle (D5).

---

## 2. Le device & le modèle TRMNL — rappels (cf. spec sejour §2)

Faits réutilisés tels quels :

- Écran 7,5", **800×480, monochrome**. Pas de couleur.
- Plugin privé « polling » : **les serveurs TRMNL** appellent une URL Kerbrise, mergent le JSON dans un template Liquid (au **nœud racine**), rendent l'image. Le device ne contacte jamais kerbrise.fr.
- `refresh_interval` = **minimum** entre deux fetchs (15/60/360/720/1440 min). Pour un contenu qui change 1×/jour, un intervalle large (ex. 360 min) suffit largement.
- Échec de poll ⇒ le device garde le dernier écran. Aucune page blanche, mais un écran figé a l'air à jour → l'**horodatage de génération** est le seul indice de fraîcheur (repris ici).
- Auth sortante : champ « polling headers », `authorization=bearer xxx`.
- Template versionné dans le repo via `trmnlp` (`settings.yml` + `.liquid`).

**Conséquence directe** : comme pour le séjour, **le serveur formate, le template affiche** (aucune logique dans le Liquid au-delà de `if`/`for`). Toutes les chaînes — lignes du synopsis, lignes de vocabulaire — sont produites en TypeScript, déjà tronquées au budget caractères.

---

## 3. Décisions d'architecture

**D1 — Plugin + endpoint DÉDIÉS, hors du registre `screen` du séjour.** *(arbitré)*
[Probable] Nouveau plugin privé TRMNL « Bahasa Film », nouvel endpoint `GET /api/term/bahasa` (nom à confirmer Q5).
Rejeté *l'intégrer comme une valeur de `TRMNL_SCREENS`* (D16 spec sejour) : ce registre modélise « la famille en séjour choisit l'écran de la maison ». Une flashcard de langue personnelle n'a ni rapport avec l'occupation, ni la même cadence, ni le même public. Les mélanger pollue la logique de switch et son autorisation RLS. Sur le device, c'est simplement un **item de playlist supplémentaire**.

**D2 — Génération DÉCOUPLÉE du poll : Vercel Cron 1×/jour → écrit une ligne en DB → l'endpoint lit la dernière ligne.** *(décision centrale)*
[Certain] Le LLM **ne tourne jamais** sur un poll TRMNL (lent, coûteux, ~plusieurs polls/jour). Le cron quotidien fait : tirage → résolution film → grounding → appel LLM → **upsert d'une ligne `bahasa_film_daily`**. L'endpoint TRMNL se contente d'un `SELECT` de la ligne du jour (ou de la dernière disponible). Même philosophie que D9/D12 du séjour (lectures Supabase gratuites, tiers cachés/pré-calculés).

**D3 — Catalogue TSPDT CACHÉ, jamais scrapé quotidiennement.** *(reco)*
[Probable] La liste GF1000 est un **classement annuel** (stable ~1 an). Scraper 122 Ko de HTML à chaque cron est inutile et fragile.
Reco : **scraper une fois** → `lib/bahasa/tspdt-1000.json` committé (rang, titre, réalisateur, année, pays). Le cron lit ce fichier, `films[N-1]`. Rituel : régénérer le JSON ~1×/an (comme `tides-times-2026`, option C du séjour). `cheerio` est déjà une dépendance du repo → parsing trivial.
Rejeté *scrape live dans le cron* : dépendance runtime à un site tiers + parsing HTML cassable, pour une donnée qui ne bouge pas.

**D4 — Tirage : SANS REMISE, déterministe par date.** *(reco — challenge la demande littérale)*
Je ne suis pas d'accord avec « random int 1–1000 » pur. Raison : avec remise, les répétitions arrivent vite — sur ~100 jours la probabilité de retomber sur un film déjà vu dépasse ~99 % (paradoxe des anniversaires), et pour un outil d'apprentissage un jour répété est un jour perdu. Voici ce que je ferais à la place : **tirage sans remise** — on garde l'ensemble des rangs déjà servis (colonne/table d'historique), on tire au hasard parmi les non-vus ; après épuisement des 1000 (≈ 2,7 ans), on rebat les cartes. Risque de mon approche : une pincée de logique d'état en plus. Risque de la tienne : redondance rapide.
[Certain] **Idempotence** : la clé est la **date Europe/Paris** (`todayInParis()`, déjà au repo). Si une ligne existe pour aujourd'hui, le cron est un **no-op** — un retry Vercel ne change pas le film du jour.
→ tranché en Q2.

**D5 — Grounding factuel obligatoire : TMDB en résolveur canonique ; Allociné en option.** *(reco)*
TSPDT ne donne que `titre + réalisateur + année`. Pour éviter l'hallucination (cf. §1) :
[Probable] Pipeline : `TMDB /search/movie?query=<titre>&year=<année>` → vérifier le réalisateur via les crédits → prendre le `overview` réel (langue `fr` ou `id` si dispo, sinon `en`). Le LLM **résume/traduit** ce texte factuel en bahasa, il n'invente pas.
Sur ton **dataset Allociné** : utilisable comme source de grounding **en français**, mais le *matching* TSPDT (titres anglais/originaux) ↔ Allociné (titres FR localisés) est flou et sans identifiant commun. À n'utiliser que si le dataset porte un ID fiable (TMDB id, année + titre original). Sinon TMDB d'abord, Allociné en enrichissement.
Design : **provider de synopsis enfichable** (`lib/bahasa/synopsis/`), défaut TMDB. → schéma/couverture Allociné à confirmer Q3.
[Hypothèse] Couverture TMDB du GF1000 ≈ quasi complète, y compris cinéma ancien/mondial — mais quelques rangs profonds peuvent manquer ; edge case géré §6.

**D6 — LLM : 1 appel/jour, sortie JSON validée comme un contrat.** *(arbitré : in-app + API LLM)*
[Probable] **Anthropic API**, modèle économique (Haiku) : 1 appel/jour ⇒ coût négligeable. Première intégration LLM du codebase → `ANTHROPIC_API_KEY` (env Vercel, server-only), code confiné à `lib/bahasa/generate.ts`.
Sortie **strictement structurée** (JSON), validée avant insertion :
```
{ "synopsis_lines": ["…","…","…"],          // exactement 3
  "vocab": [ { "word":"…", "pos":"n./v./adj.",
              "gloss":"…", "example":"…?" } ] }  // exactement 3
```
Validation : 3 lignes, chacune ≤ budget caractères (D7) ; 3 entrées vocab ; champs non vides. Échec ⇒ **1 retry** avec contrainte renforcée, puis **fallback** (cf. D9). Le synopsis doit rester **fidèle au `overview`** fourni (instruction de prompt + interdiction d'ajouter des faits).

**D7 — Budget d'affichage : le serveur tronque, le template affiche.** *(reco)*
[Hypothèse] À la taille de corps du template séjour, ~**42–48 caractères/ligne** tiennent en 800 px. Cible : titre + réalisateur/année en en-tête, **3 lignes de synopsis ≤ ~45 car.**, **3 lignes de vocabulaire** (`mot — gloss`). Budget exact figé à l'étape template sur rendu réel. Le prompt LLM reçoit ce budget ; le serveur re-tronque en garde-fou.

**D8 — Timezone & horodatage.** [Certain] Cron planifié en pensant **Europe/Paris** (Vercel = UTC → `0 3 * * *` UTC ≈ 04/05h Paris selon DST). Clé de jour = `todayInParis()`. L'endpoint renvoie `generated_at_label` + `film_date_label` pour exposer toute fraîcheur/retard (un e-ink figé paraît à jour).

**D9 — Aucune panne ne casse l'écran.** [Certain] Si TMDB ou le LLM échoue, le cron **n'écrase pas** la dernière bonne ligne ; l'endpoint sert la **dernière ligne disponible** (avec sa date réelle, donc visiblement datée d'hier). Jamais de 500 sur le poll (mirroir D12 séjour). Option v1.1 : marquer la ligne `degraded` + petite alerte.

**D10 — Auth & exécution.** [Certain] Endpoint poll protégé par `Authorization: Bearer` (réutilise le pattern `timingSafeEqual` de `/api/term` ; token dédié `TRMNL_BAHASA_TOKEN` ou réutilise `TRMNL_API_TOKEN` — Q5). Route cron `/api/cron/bahasa` protégée par `CRON_SECRET` (header Vercel Cron). `force-dynamic` sur l'endpoint poll.

---

## 4. Contrat API

### Cron (déclencheur quotidien)
```
GET /api/cron/bahasa
Authorization: Bearer <CRON_SECRET>      // injecté par Vercel Cron
→ 200 { "status": "generated" | "noop" | "degraded", "rank": 412, "title": "…" }
```
Idempotent par date Paris (D4). Aucune donnée sensible.

### Poll (consommé par TRMNL)
```
GET /api/term/bahasa
Authorization: Bearer <token>
```
```json
{
  "generated_at_label": "jeu. 18 juin · 04:03",
  "film_date_label": "jeu. 18 juin",
  "rank": 412,
  "film": {
    "title": "Sansho the Bailiff",
    "director": "Mizoguchi, Kenji",
    "year": 1954,
    "country": "Japan"
  },
  "synopsis_lines": [
    "Seorang gubernur diasingkan karena membela rakyat.",
    "Istri dan anaknya terpisah lalu dijual sebagai budak.",
    "Bertahun-tahun kemudian, sang anak mencari keadilan."
  ],
  "vocab": [
    { "word": "diasingkan", "pos": "v.", "gloss": "exilé / banni" },
    { "word": "budak",      "pos": "n.", "gloss": "esclave" },
    { "word": "keadilan",   "pos": "n.", "gloss": "justice" }
  ],
  "status": "ok"
}
```
Règles :
- `status: "degraded"` ⇒ ligne d'hier servie (D9) ; le template peut afficher un discret « màj hier ».
- Schéma = **contrat avec le Liquid**, sans compilateur : renommer une clé = écran cassé en silence (leçon D11 séjour).
- **401** token absent/invalide. **500** réservé aux erreurs internes (jamais déclenché par TMDB/LLM down).

---

## 5. Mock 800×480

```
┌──────────────────────────────────────────────────┐
│ BAHASA · Film du jour            #412 · màj 04:03 │
│──────────────────────────────────────────────────│
│  SANSHO THE BAILIFF                               │
│  Mizoguchi, Kenji · 1954 · Japan                  │
│──────────────────────────────────────────────────│
│  Seorang gubernur diasingkan karena membela       │
│  rakyat. Istri dan anaknya terpisah lalu dijual   │
│  sebagai budak. Anaknya mencari keadilan.         │
│──────────────────────────────────────────────────│
│  KOSAKATA                                         │
│  diasingkan (v.)  — exilé / banni                 │
│  budak (n.)       — esclave                       │
│  keadilan (n.)    — justice                       │
└──────────────────────────────────────────────────┘
```
Hiérarchie :
- **Niveau 1** : titre + métadonnées film (lecture rapprochée, c'est un objet d'étude, pas un panneau à 3 m).
- **Niveau 2** : synopsis bahasa (3 lignes), puis bloc vocabulaire (`mot (pos) — gloss`).
- `#rang` + horodatage en en-tête = traçabilité + indice de fraîcheur.

---

## 6. Règles métier & edge cases

- **Tirage** (D4) : `N` parmi les rangs non encore servis ; idempotent par date Paris. Historique vidé/rebattu après 1000.
- **Film introuvable sur TMDB** (rang profond) : 2 stratégies possibles — (a) re-tirer un autre rang non-vu (le film « manqué » reste disponible plus tard), ou (b) générer sans grounding **en signalant** la moindre fiabilité. Reco : **(a)**, on ne dégrade pas la qualité. À trancher implicitement à l'implémentation.
- **`overview` TMDB absent ou trop court** : tenter langue alternative (`en` → `fr`) ; si vide, traiter comme « introuvable » (re-tirage).
- **Synopsis trop long** : le LLM reçoit le budget ; le serveur re-tronque proprement (sur mot) en dernier recours.
- **Vocabulaire** : éviter les mots-outils (yang, dan, di…) ; viser un niveau utile (intermédiaire). [v1.1] dédup contre l'historique vocab pour ne pas re-servir « budak » 10×.
- **Langue du gloss** : Matt est francophone → gloss en **français** (reco Q4).
- **Double déclenchement cron** : no-op grâce à l'idempotence date (D4).
- **Rafraîchissement annuel du catalogue** : régénérer `tspdt-1000.json` chaque année (le classement bouge).
- **DST** : le cron à heure UTC fixe glisse d'1 h en hiver — sans impact (génération nocturne large).

---

## 7. Sécurité & vie privée

- **Donnée non sensible** : aucun nom de famille, aucune donnée d'occupation. Contraste total avec le séjour → token utile surtout pour éviter l'abus de l'endpoint, pas pour protéger un secret.
- **Clés** : `ANTHROPIC_API_KEY`, `TMDB_API_KEY`, `CRON_SECRET`, token poll — toutes en env Vercel, server-only. Première clé LLM du codebase : la confiner à `lib/bahasa/`.
- **Coût** : 1 appel Haiku + 1 appel TMDB / jour ≈ négligeable. Pas de boucle, pas d'appel sur le poll (D2).
- **Tiers** : usage TMDB conforme à leurs CGU (clé gratuite). Scrape TSPDT = 1×/an, manuel, pour usage privé.

---

## 8. Fichiers impactés

| Fichier | Statut | ~Taille |
|---|---|---|
| `lib/bahasa/tspdt-1000.json` (catalogue committé, D3) | nouveau | ~120 Ko |
| `scripts/bahasa/scrape-tspdt.ts` (régénération annuelle) | nouveau | ~40 l. |
| `lib/bahasa/select.ts` (tirage sans remise, idempotent) | nouveau | ~40 l. |
| `lib/bahasa/synopsis/tmdb.ts` (+ interface provider) | nouveau | ~60 l. |
| `lib/bahasa/generate.ts` (LLM + validation contrat) | nouveau | ~90 l. |
| `lib/bahasa/types.ts` | nouveau | ~30 l. |
| `app/api/cron/bahasa/route.ts` (pipeline quotidien) | nouveau | ~50 l. |
| `app/api/term/bahasa/route.ts` (poll, lit la DB) | nouveau | ~40 l. |
| `db/migrations/000X_bahasa_film_daily.sql` (table + historique) | nouveau | — |
| `vercel.json` (bloc `crons`) | nouveau | — |
| `trmnl-plugin-bahasa/` (`settings.yml` + `.liquid`) | nouveau | — |
| `docs/specs/trmnl-bahasa-film.md` | cette spec | — |
| `CHANGELOG.md` | modif | — |

Deps à ajouter : `@anthropic-ai/sdk`. (`cheerio`, `date-fns` déjà présents.)
Env Vercel : `ANTHROPIC_API_KEY`, `TMDB_API_KEY`, `CRON_SECRET`, `TRMNL_BAHASA_TOKEN` (ou réutilise `TRMNL_API_TOKEN`).

**Schéma `bahasa_film_daily`** (indicatif) : `date_paris` (PK), `rank`, `title`, `director`, `year`, `country`, `synopsis_lines jsonb`, `vocab jsonb`, `source` (`tmdb`/`allocine`/`none`), `status`, `created_at`.

---

## 9. Hors scope

Audio/prononciation · quiz interactif (l'e-ink ne saisit pas) · plusieurs films/jour · suivi d'apprentissage (SRS type Anki) · traduction de la fiche complète · intégration au switch d'écran familial (D1).

---

## 10. Questions ouvertes

- **Q1** — Même device que le salon Saint-Malo (un item de playlist en plus) ou un device perso ? *(n'affecte que le réglage côté TRMNL, pas le code.)*
- **Q2** — Tirage : **sans remise** (reco D4) ou aléatoire pur (demande littérale) ?
- **Q3** — Grounding : ton **dataset Allociné** porte-t-il un ID fiable (TMDB id / titre original + année) ? Si oui → grounding FR possible. Sinon TMDB par défaut (D5).
- **Q4** — Langue du gloss vocab : **français** (reco) / anglais / définition en bahasa ?
- **Q5** — Nom & token de l'endpoint poll : `/api/term/bahasa` + token dédié (reco) ou réutilise l'existant ?

---

## 11. Plan d'implémentation

### v1
| # | Étape | Vérification |
|---|---|---|
| 0 | Lire `/api/term`, `lib/dates.ts` (`todayInParis`), `lib/data/types.ts` ; obtenir une clé TMDB ; trancher Q2–Q5 | Hypothèses levées ou spec amendée |
| 1 | `scripts/bahasa/scrape-tspdt.ts` → `tspdt-1000.json` | 1000 lignes, rangs 1/500/1000 corrects (Citizen Kane #1) |
| 2 | `lib/bahasa/select.ts` (sans remise + idempotence date) | Tests purs : pas de doublon avant épuisement ; 2 appels même jour ⇒ même rang |
| 3 | `lib/bahasa/synopsis/tmdb.ts` | Résout 5 rangs (dont 1 profond ~900) ; vérif réalisateur ; `overview` non vide |
| 4 | `lib/bahasa/generate.ts` (LLM + validation) | 5 sorties valides : 3 lignes ≤ budget, 3 vocab, fidèles à l'overview |
| 5 | Migration `bahasa_film_daily` + `/api/cron/bahasa` | Cron local : upsert 1 ligne ; 2ᵉ run = noop |
| 6 | `/api/term/bahasa` (poll) + 401 | `curl` sans token → 401 ; avec → JSON conforme §4 |
| 7 | `vercel.json` cron + déploiement | Cron prod tire à l'heure prévue ; ligne créée |
| 8 | Plugin TRMNL + template `trmnl-plugin-bahasa/` | Rendu conforme mock §5 sur device ; texte non tronqué disgracieusement |
| 9 | Clôture : CHANGELOG, mémoire | — |

### v1.1 (si l'usage tient)
| # | Étape |
|---|---|
| 10 | Dédup vocabulaire contre l'historique |
| 11 | Enrichissement / bascule grounding Allociné (selon Q3) |
| 12 | Marquage `degraded` + alerte sur échec cron |

**Étape de vérification dédiée (avant câblage cron)** : exécuter `generate.ts` sur un échantillon de 5 rangs dont un film obscur (~rang 900) ; contrôler le contrat JSON + budget caractères + **rétro-traduction** rapide du bahasa pour valider la fidélité à l'overview. C'est le point où une hallucination ou un bahasa douteux doit être attrapé.

---

## 12. Références

- Source films : https://theyshootpictures.com/gf1000_all1000films_table.php
- TMDB API : https://developer.themoviedb.org/reference/intro/getting-started
- Anthropic API : https://docs.claude.com
- Vercel Cron Jobs : https://vercel.com/docs/cron-jobs
- Spec voisine (conventions device/token/Liquid) : `docs/specs/trmnl-sejour-display.md`
- Guide plugin TRMNL : `docs/guides/trmnl-plugin-guide.md`
