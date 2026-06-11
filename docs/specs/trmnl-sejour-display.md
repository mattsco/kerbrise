# Spec — Écran TRMNL « Séjour » + API screen

> **Statut** : 🚧 Draft v0.3 — Q3 / Q5 / Q6 ouverts, le reste arbitré
> **Créée** : 11/06/2026 · **Cible** : v1.2.x · **Backlog** : #32 [Hypothèse — numéro à confirmer]
> **Dépendances** : aucune bloquante. Synergie forte avec #26 (Mode vacances). #14 (WiFi en DB) : contourné en v1 par env vars.
>
> **Historique** :
> v0.1 (11/06) draft initial · v0.2 (11/06) Q1/Q2 arbitrés (contenu élargi, transit cloud OK), phasage v1/v1.1, D12–D15 · v0.3 (11/06) **switch d'écrans arbitré** (état DB Kerbrise ; famille en séjour + admins) → D16/D17, endpoint renommé `/api/trmnl/screen`, clé `screen` au contrat v1, phase v1.2.

---

## 1. Contexte & objectif

Un TRMNL OG (e-ink 7,5", 800×480) sera installé dans la maison de Saint-Malo. Il affiche en continu l'état « séjour » : qui occupe la maison, qui arrive ensuite, infos pratiques (poubelles, WiFi ; en v1.1 météo + marées).

**Contrôle d'écran (v1.2)** : 3–4 écrans préparés (séjour, marées, calendrier, …). Depuis l'app, la famille en séjour (+ admins) choisit l'écran affiché. Mécanisme arbitré : **état en DB Kerbrise** — TRMNL polle notre API, le choix d'écran est notre état, pas le sien. UI en v1.2 dans la section profil ; maison naturelle à terme : la future page Mode vacances (#26).

**Relation avec #26** : #26 n'est pas spécifié. Cette spec définit le **contrat de données séjour** (`lib/data/sejour.ts`), consommé par (a) la route TRMNL maintenant, (b) la page #26 plus tard. L'API HTTP, elle, est spécifique TRMNL.

**Garde-fou** : ne pas réduire le futur #26 à ce que l'e-ink sait afficher. Le snapshot est un sous-ensemble.

**Point ouvert** : « prochain guest » (Q5) — concept à définir avant spécification.

---

## 2. Le device — faits vérifiés (11/06/2026)

| Fait | Détail | Conséquence pour Kerbrise |
|---|---|---|
| Écran | 7,5", 800×480, monochrome (4 niveaux de gris sur les unités récentes) | Pas de couleur → le code couleur famille n'existe pas ici |
| Modèle de données | Plugin privé « polling » : **les serveurs TRMNL** appellent l'URL, injectent le JSON dans un template Liquid, rendent l'image ; le device se réveille et récupère l'image | kerbrise.fr n'est jamais contacté par le device ; les données transitent et sont stockées chez TRMNL (accepté — Q2) |
| Fraîcheur | « On-demand refresh » : le plugin est rafraîchi quand le device avance vers cet écran ; `refresh_interval` (15/60/360/720/1440 min) = **minimum** entre deux fetchs | Latence d'un changement ≈ prochain réveil du device (≤ son intervalle) |
| Pas de push | Le device dort entre deux réveils ; aucune API ne peut le réveiller. Bouton au dos = réveil manuel [Probable : sert le dernier rendu ; avec une playlist à 1 item, le « hors ordre » documenté ne s'applique pas — à tester] | Tout changement d'écran est différé ; l'UI doit l'assumer |
| Auth sortante | Champ « polling headers », format `authorization=bearer xxx` | Auth par token, zéro firmware à toucher |
| Allowlist IP | IPs des serveurs TRMNL publiées sur `trmnl.com/api/ips` | Défense en profondeur possible (optionnel, v1.1) |
| Sleep Mode | Plage horaire fixe (ex. 23h–7h) dans les settings device ; supprime les réveils, gain d'autonomie significatif. Pilotable via l'API device TRMNL (cf. intégration Home Assistant) | Levier batterie réel = réduire les réveils, pas « éteindre l'image » (D14) |
| Versionnage template | Export/import zip (`settings.yml` + `.liquid`) ; CLI `trmnlp` (Ruby/Docker) : `serve`, `push`, `pull`, `lint` | Le template vit dans le repo (`trmnl/`) — répond au risque « backend hors repo » (review §3.4) |
| Échec de poll | Le device garde le dernier écran ; échecs répétés → plugin « degraded », refresh possiblement stoppés (reset manuel) | Pas de page blanche, mais prévoir test post-panne |
| API compte TRMNL | `GET/PATCH /api/playlist_items` (beta, clé Account) permet de masquer/afficher des items de playlist | Existe, mais rejeté pour le switch (D16) |
| Batterie | 1800 mAh, autonomie ~1 à 3 mois selon refresh | 60 min + sleep nocturne = bon compromis |

---

## 3. Décisions d'architecture

**D1 — Stratégie : plugin privé, polling.**
Rejeté *webhook* : « Jour x/y », « dans N jours », poubelles et marées changent chaque nuit **sans événement DB** → cron quotidien nécessaire en plus. Le polling couvre tout, zéro infra.
Rejeté *BYOS / génération d'image maison* : disproportionné pour 1 device (confirmé par Q2 = oui).

**D2 — Un seul endpoint : `GET /api/trmnl/screen`.** *(renommé en v0.3, ex-`/sejour`)*
Il sert désormais N écrans — renommage gratuit avant implémentation, breaking change après (contrat template). TRMNL merge un JSON unique ; le multi-URL ajoute des nœuds `IDX_n` sans bénéfice. Le device ne dépend que d'un endpoint Kerbrise — c'est l'API qui agrège les sources externes (D12) et sélectionne l'écran (D16).

**D3 — Auth : `Authorization: Bearer ${TRMNL_API_TOKEN}`.**
Token ≥ 32 octets aléatoires (`openssl rand -hex 32`), env Vercel. Jamais en query string (logs). Rotation = changer l'env + le champ headers du plugin. Allowlist IP : v1.1 optionnel.

**D4 — Accès données via client Supabase service role : `lib/supabase/service.ts`, marqué `import "server-only"`.**
[Hypothèse] La service key n'est utilisée nulle part aujourd'hui — première introduction dans le codebase. Règle : importable uniquement depuis route handlers / server actions ; grep `SERVICE_ROLE` à chaque revue.
Rejeté *policy RLS pour anon* : exposerait les bookings à quiconque détient l'anon key.

**D5 — Logique dans `lib/data/sejour.ts` (`getSejourSnapshot()` + builders par écran), la route = vérif token + assemblage.**
Réutilise le mapper bookings de `lib/data/bookings.ts` — pas de 7ᵉ copie de la requête (review §3.1). Signatures alignées sur le style existant de `lib/data/` (à lire en étape 0).

**D6 — Le serveur formate, le template affiche.**
Toutes les chaînes (« 6 → 18 juin », « Jour 6/13 », « Coef 95 ») sont produites en TypeScript, testables et versionnées. Le Liquid ne porte que des `if`/`case` de présence. Contrainte TRMNL : merge variables au **nœud racine** du payload.

**D7 — Timezone : tout « aujourd'hui » calculé explicitement en Europe/Paris.**
Vercel tourne en UTC : entre ~22h/23h UTC et minuit, la date UTC est en retard d'un jour sur Paris. Nouvelle helper `todayInParis()` dans `lib/dates.ts`. Interdit : `new Date().toISOString().slice(0, 10)`. Même famille de bug que `demandes/page` (review §5). Pendant SQL : voir D17.

**D8 — Périmètre bookings : `approved` uniquement, fenêtre `[J−60, J+60]`.**
Borne basse = séjour courant commencé il y a longtemps (durée max 60 j). Les `pending` n'apparaissent jamais. Au plus un séjour courant si la contrainte d'exclusion est en prod [Hypothèse — review §8.1] ; le code prend `min(start)` et logge toute anomalie.

**D9 — Route `force-dynamic`, sources externes cachées (D12).**
~24 polls/jour : la requête Supabase à chaque poll est gratuite ; on cache les appels tiers.

**D10 — Middleware : `/api/trmnl/*` doit être hors du flux auth.**
[Hypothèse] Le matcher actuel couvre peut-être `/api` ; si oui, un poll sans cookie recevrait une redirection /login → HTML dans le template. **Étape 0 = lire `middleware.ts`.**

**D11 — Template versionné dans le repo : `trmnl/` (`settings.yml` + `full.liquid`).**
Workflow A (idéal) : `trmnlp` — `serve` local, `push`. [Hypothèse] Ruby sous Termux : preview HTML OK (le PNG exige Firefox + ImageMagick) — à tester. Workflow B (fallback Termux) : éditeur web TRMNL, export zip, commit. **Tout changement de schéma JSON ⇒ MAJ du template dans le même commit.**

**D12 — Sources externes (météo, marées) : agrégées par l'API Kerbrise, jamais par le template.**
L'API fetche et met en cache : météo via `fetch(..., { next: { revalidate: 1800 } })`, marées 1×/jour (ou table statique, §7). Source défaillante ⇒ champ `null`, bloc masqué — jamais de 500 à cause d'un tiers.
Météo : **Open-Meteo** (gratuit, sans clé, lat 48.65 / lon −2.03). Marées : décision Q6 (§7).

**D13 — WiFi en v1 via env vars + QR code.**
`WIFI_SSID` / `WIFI_PASSWORD` en env Vercel ; payload QR standard `WIFI:T:WPA;S:<ssid>;P:<pass>;;`. QR rendu par le template si faisable [Probable], sinon data-URI SVG généré côté API. Migration vers la DB quand #14 — le contrat ne changera pas. Conséquence Q2 : le mot de passe résidera chez TRMNL (accepté).

**D14 — « Écran éteint quand maison vide » : reformulé.**
[Certain] Un e-ink statique ne consomme presque rien ; la batterie part dans les réveils. Retenu v1 : (a) écran « MAISON LIBRE » épuré ; (b) Sleep Mode nocturne natif ; (c) interrupteur physique au rituel de fermeture. v2 possible : cron Kerbrise pilotant le Sleep Mode via l'API device TRMNL selon l'occupation.

**D15 — Phasage.**
**v1 (semaine prochaine)** : écran 'sejour' (séjour + arrivée + poubelles + WiFi/QR), clé `screen` déjà au contrat. Zéro dépendance externe, le device est en service.
**v1.1** : météo (Open-Meteo) + marées (Q6) + « guest » (Q5) + allowlist IP.
**v1.2** : switch d'écrans (D16/D17) + écrans 'marees' et 'calendrier'.

**D16 — Switch d'écran : état en DB Kerbrise, un seul plugin.** *(nouveau v0.3 — arbitré)*
- Table singleton `house_settings` (migration versionnée) : `trmnl_screen` (default `'sejour'`), `updated_at`, `updated_by`.
- Registre dans `lib/config.ts` : `TRMNL_SCREENS = ['sejour', 'marees', 'calendrier', …] as const`. Le server action valide contre cette liste ; chaque écran = builder de payload + branche template, ajoutés **dans le même commit** (D11).
- Écran effectif **dérivé, zéro cron** :
  `screen = (maison occupée ET selection.updated_at ≥ début du séjour courant) ? selection.trmnl_screen : 'sejour'`.
  Reset automatique à chaque changement de séjour, jour pivot inclus. Maison libre ⇒ `'sejour'` forcé, contrôle désactivé dans l'UI (admins compris — simplicité).
- Latence assumée dans l'UI : « appliqué d'ici ~15 min » + astuce : bouton au dos du cadre. Grâce à l'on-demand refresh, le changement part au prochain réveil du device. Mesure réelle en étape 15.
- **Rejeté** : `PATCH /api/playlist_items` (4 plugins, API beta TRMNL) — source de vérité éclatée, clé Account + mapping d'IDs à maintenir, pannes silencieuses. À réserver au seul cas « plugins natifs TRMNL dans la rotation ».

**D17 — Autorisation : famille en séjour + admins, écrite une fois en SQL.** *(nouveau v0.3 — arbitré)*
- La règle vit dans une **policy RLS versionnée** (`db/migrations/`) : UPDATE autorisé si `is_admin` OU membre de la famille du booking `approved` couvrant aujourd'hui.
- ⚠️ **Piège timezone côté SQL** : `current_date` = date UTC sur Supabase → le droit basculerait avec 1–2 h de retard chaque soir. Utiliser `(now() at time zone 'Europe/Paris')::date`. Pendant TS : D7.
- Le server action `setTrmnlScreen()` re-vérifie en TS (erreur précoce + UX) et l'UI n'affiche le contrôle qu'aux éligibles — mais **l'autorité est la policy** (leçon review §3.2 : RLS explicite et versionnée, jamais implicite).
- Noms de colonnes (`start_date`, `family_id`, `is_admin`…) : indicatifs, à aligner en étape 0.

---

## 4. Contrat API

```
GET /api/trmnl/screen
Authorization: Bearer <TRMNL_API_TOKEN>
```

Enveloppe commune : `generated_at_label`, `status`, `screen`, `wifi`. Blocs spécifiques selon `screen`. En v1, seul `screen = "sejour"` existe.

### 200 — écran 'sejour', maison occupée (exemple : jeu. 11 juin 2026, pivot à venir, phase v1)

```json
{
  "generated_at_label": "jeu. 11 juin · 08:15",
  "status": "occupied",
  "screen": "sejour",
  "stay": {
    "family": "Vincent",
    "member": "Marie",
    "dates_label": "6 → 18 juin",
    "progress_label": "Jour 6/13",
    "departure_label": "Départ jeu. 18 juin"
  },
  "next": {
    "family": "Antoine",
    "arrival_label": "jeu. 18 juin",
    "countdown_label": "Dans 7 jours",
    "is_pivot": true,
    "pivot_label": "Jour pivot — arrivée le jour du départ"
  },
  "garbage": {
    "label": "Bacs jaunes",
    "when_label": "Demain (ven. 12 juin)"
  },
  "wifi": {
    "ssid": "Kerbrise",
    "password": "••••••••",
    "qr_payload": "WIFI:T:WPA;S:Kerbrise;P:••••••••;;"
  },
  "weather": null,
  "tides": null
}
```

### Champs v1.1 (mêmes clés, non-null)

```json
{
  "weather": { "summary_label": "Éclaircies", "temp_label": "14° / 19°" },
  "tides": {
    "high_label": "PM 06:12 · 18:34",
    "low_label": "BM 00:48 · 13:02",
    "coef_label": "Coef 95"
  }
}
```

### 200 — écran 'sejour', maison libre

```json
{
  "generated_at_label": "mar. 30 juin · 07:45",
  "status": "free",
  "screen": "sejour",
  "stay": null,
  "next": {
    "family": "François",
    "arrival_label": "ven. 3 juil.",
    "countdown_label": "Dans 3 jours",
    "is_pivot": false,
    "pivot_label": null
  },
  "garbage": { "label": "Ordures ménagères", "when_label": "Aujourd'hui" },
  "wifi": { "...": "..." },
  "weather": null,
  "tides": null
}
```

### Écrans v1.2 (payloads à spécifier lors de la phase v1.2)

- `screen = "marees"` : bloc `tides_screen` — tableau multi-jours (PM/BM/coef sur ~5 jours), grandes marées mises en avant. Dépend du sourcing Q6.
- `screen = "calendrier"` : bloc `calendar_screen` — **grille pré-calculée côté serveur** (tableau de semaines → jours, avec libellés et drapeaux de remplissage par famille) ; le Liquid ne fait que boucler.

Règles :
- `next: null` si aucun séjour approuvé à venir → « Aucun séjour prévu ».
- Tout bloc optionnel (`garbage`, `wifi`, `weather`, `tides`, blocs d'écran) peut être `null` → bloc masqué. Une source externe en panne ne casse jamais l'écran (D12).
- **401** `{"error":"unauthorized"}` — token absent/invalide. **500** `{"error":"internal"}` — réservé aux erreurs internes.
- ⚠️ Le schéma est un **contrat avec le template Liquid**, sans compilateur. Renommer une clé = écran cassé silencieusement. Voir D11.

---

## 5. Écran 'sejour' v1 — mock 800×480

```
┌──────────────────────────────────────────────────┐
│ KERBRISE · Saint-Malo                  màj 08:15 │
│──────────────────────────────────────────────────│
│  SÉJOUR EN COURS                      ┌────────┐ │
│  VINCENT                              │   QR   │ │
│  Marie · 6 → 18 juin                  │  WiFi  │ │
│  Jour 6/13 · Départ jeu. 18 juin      └────────┘ │
│──────────────────────────────────────────────────│
│  PROCHAINE ARRIVÉE                               │
│  Antoine · jeu. 18 juin (dans 7 jours)           │
│  ⚠ Jour pivot — arrivée le jour du départ        │
│──────────────────────────────────────────────────│
│  Poubelles : bacs jaunes — demain (ven. 12)      │
│  14°/19° éclaircies · PM 06:12 · 18:34 · Coef 95 │   ← ligne v1.1
└──────────────────────────────────────────────────┘
```

Hiérarchie en deux niveaux :
- **Niveau 1 — glanceable à 3 m** : famille en cours (capitales, très gros) ou « MAISON LIBRE », prochaine arrivée.
- **Niveau 2 — lecture rapprochée** : footer dense (poubelles, météo, marées) + QR WiFi (objet de proximité par nature).

Identité famille sans couleur : capitales + taille ; option v1.1 : motif/bordure par famille (design template, n'impacte pas l'API).
`generated_at_label` indispensable : sur e-ink, un écran figé a l'air à jour — l'horodatage est le seul indice de panne.
Mocks des écrans 'marees' et 'calendrier' : phase v1.2.

---

## 6. Règles métier & edge cases

- **Séjour courant** : `start ≤ today < end` — bornes `[)`, cohérentes avec la contrainte d'exclusion. Jour pivot : à minuit, bascule sur la famille entrante. Option v1.1 : « Les X partent ce matin ».
- **Prochaine arrivée** : premier booking `approved` avec `start > today`. Règle unique, maison occupée ou libre.
- **Jour x/y** : x = `today − start + 1`. y : **à trancher (Q3)** — jours inclusifs (`end − start + 1`, reco) ou nuits. À aligner sur l'affichage PWA existant.
- **« Dans N jours »** : `start − today` en jours civils Europe/Paris.
- **Écran effectif** : règle dérivée D16 — aucune mutation, aucun cron ; testable en pur.
- **DST** : tester aux bascules (29 mars / 25 oct. 2026) — chaîne TS via `todayInParis()`, chaîne SQL via `at time zone` (D17).
- **Jointures manquantes** (user/famille) : fallbacks du mapper existant.
- **Source externe en panne** : champ `null`, bloc masqué, log. Jamais de 500 causé par un tiers.
- **Panne API Kerbrise** : le device garde le dernier écran ; échecs répétés → « degraded » côté TRMNL. Post-incident : force refresh dashboard.

---

## 7. Sourcing marées + coefficient (Q6 — décision requise)

Contexte vérifié (11/06/2026) :
- Le service officiel SHOM (« Marées à la carte » / SPM) fournit heures, hauteurs **et coefficients**, mais l'API nécessite un **abonnement payant** avec clé.
- Le portail public maree.shom.fr offre la consultation gratuite (≈ 10 jours glissants) ; la vignette gratuite est un widget HTML, pas du JSON.
- maree.info interdit explicitement l'extraction automatisée (CGU).
- Le **coefficient est une donnée nationale** : calculé pour Brest, équivalent de Dunkerque à Saint-Jean-de-Luz. Seules les heures PM/BM sont propres à Saint-Malo.

| Option | Description | Coût / risque | Verdict |
|---|---|---|---|
| **A** | API SHOM officielle (abonnement + clé) | Coût récurrent ; licence propre ; données de référence | Propre et automatique — si le coût est accepté |
| **B** | Vignette/portail SHOM gratuits, parsés | Gratuit | Parsing HTML fragile, hors usage prévu — **rejeté** |
| **C** | **Table annuelle statique committée** (`lib/data/tides-2026.json` : heures PM/BM Saint-Malo + coef) | Génération 1×/an (janvier) ; reproduction de prédictions SHOM = zone grise de licence, risque faible pour un affichage privé familial | **Reco** : zéro dépendance runtime, données exactes, ~40 Ko |
| **D** | API tierce mondiale (WorldTides, Stormglass…) pour les heures + table coef séparée | Gratuit/low-cost ; pas de coefficient français nativement | Hybride bancal — repli |

Reco : **C**. Rituel : régénérer le fichier chaque janvier. Zéro maintenance manuelle souhaitée → A.

---

## 8. Fichiers impactés

### v1

| Fichier | Statut | ~Taille |
|---|---|---|
| `lib/supabase/service.ts` | nouveau | 20 l. |
| `lib/data/sejour.ts` (+ types) | nouveau | 140 l. |
| `app/api/trmnl/screen/route.ts` | nouveau | 40 l. |
| `lib/dates.ts` — ajout `todayInParis()` | modif | +10 l. |
| `middleware.ts` | modif si D10 le requiert | ±5 l. |
| `trmnl/settings.yml`, `trmnl/full.liquid` | nouveau | — |
| `docs/specs/trmnl-sejour-display.md` | cette spec | — |
| `CHANGELOG.md` | modif | — |

Env Vercel : `TRMNL_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `WIFI_SSID`, `WIFI_PASSWORD`.

### v1.1

| Fichier | Statut |
|---|---|
| `lib/external/meteo.ts` (Open-Meteo, cache 30 min) | nouveau |
| `lib/external/tides.ts` + `lib/data/tides-2026.json` (si option C) | nouveau |
| « guest » | selon Q5 |

`lib/external/` : nouveau dossier pour les sources non-Supabase — `lib/data/` reste réservé aux tables.

### v1.2

| Fichier | Statut |
|---|---|
| `db/migrations/000X_house_settings.sql` (table + policy RLS date Paris) | nouveau |
| `lib/config.ts` — ajout `TRMNL_SCREENS` | modif |
| `lib/data/house-settings.ts` (get/set) | nouveau |
| Section profil : picker d'écran (client) + server action `setTrmnlScreen()` | nouveau |
| `lib/data/sejour.ts` — builders 'marees' / 'calendrier' | modif |
| `trmnl/full.liquid` — branches par écran | modif |

---

## 9. Sécurité & vie privée

- **Exposé** : prénoms, branche familiale, dates de présence/absence, SSID + mot de passe WiFi (accepté via Q2). Pas d'email, pas de pending, pas d'IDs internes.
- Fuite de token = planning de présence + WiFi. Mitigations : token fort, rotation triviale, allowlist IP v1.1.
- **Service role** : confiné à `lib/supabase/service.ts` + `server-only`. La route ne prend aucun paramètre et ne renvoie que le payload — pas de passthrough.
- **Écriture `house_settings`** : autorité = policy RLS versionnée (D17), miroir TS/UI pour l'UX uniquement.

---

## 10. Hors scope

Demandes pending · layouts half/quadrant · BYOS · page PWA #26 (consommera `getSejourSnapshot()`) · pilotage automatique du Sleep Mode selon l'occupation (v2) · plugins natifs TRMNL dans la rotation (réouvrirait D16).

---

## 11. Questions ouvertes

- **Q3** — Sémantique « Jour x/y » : jours inclusifs (reco) ou nuits ?
- **Q5** — « Prochain guest » : définition ? (type de résa invité ? champ bookings ? synonyme de « prochaine arrivée » ?)
- **Q6** — Sourcing marées : option A / C / D (§7) — reco C.
- *(Q4 numéro backlog #32 : à confirmer au commit.)*

---

## 12. Plan d'implémentation

### v1 (semaine prochaine)

| # | Étape | Vérification |
|---|---|---|
| 0 | Lire `middleware.ts`, `lib/data/bookings.ts`, `lib/garbage-collection.ts`, `lib/dates.ts` | Hypothèses D4/D5/D10 + capacités poubelles levées, ou spec amendée |
| 1 | `lib/supabase/service.ts` + env locales | Select de test passe hors session |
| 2 | `lib/data/sejour.ts` + `todayInParis()` | Partie pure vérifiée sur 4 cas : occupé / libre / pivot / aucun futur |
| 3 | Route (`screen` dans l'enveloppe) + 401 + bloc WiFi/QR | `curl` sans token → 401 ; avec → JSON conforme §4 |
| 4 | Exclusion middleware si besoin, déploiement | `curl` prod OK |
| 5 | Plugin privé TRMNL (URL + header) + template `trmnl/` (déjà structuré en `case screen`) | Rendu conforme au mock §5, blocs null masqués |
| 6 | Device réel + Sleep Mode nocturne + test de panne (token invalide 1 h) | Écran correct ; comportement « degraded » compris |
| 7 | Clôture : spec ✅, CHANGELOG, mémoire | — |

### v1.1

| # | Étape | Vérification |
|---|---|---|
| 8 | `lib/external/meteo.ts` (revalidate 1800 s) | `weather` non-null ; panne simulée ⇒ bloc masqué |
| 9 | Marées selon Q6 (si C : `tides-2026.json` + helper) | PM/BM/coef corrects vs maree.shom.fr sur 3 dates dont une grande marée |
| 10 | « Guest » selon Q5 | — |
| 11 | Allowlist IP (optionnel) | Poll TRMNL OK ; curl hors IP → 403 |

### v1.2

| # | Étape | Vérification |
|---|---|---|
| 12 | Migration `house_settings` + policy RLS (date Paris) | UPDATE refusé hors famille occupante (test 2 comptes) ; accepté occupant + admin ; bascule correcte à 23h59/00h01 Paris |
| 13 | `lib/data/house-settings.ts` + action + UI profil | Contrôle visible/éditable selon éligibilité ; latence affichée dans l'UI |
| 14 | Builders 'marees' / 'calendrier' + branches template | Rendu conforme par écran ; la clé `screen` pilote la branche |
| 15 | Test latence réel : switch app → réveil device / bouton dos | Délai mesuré ≤ intervalle device ; comportement bouton documenté |

Estimation : **v1 = S/M** (2 sessions) · **v1.1 = S** (option C) à **M** (option A) · **v1.2 = M** (1–2 sessions).

---

## 13. Références

- Produit OG : https://shop.usetrmnl.com/collections/devices/products/trmnl
- Private plugins : https://help.trmnl.com/en/articles/9510536-private-plugins
- On-demand refresh : https://help.trmnl.com/en/articles/15123293-on-demand-plugin-refresh
- Playlist items API (beta) : https://trmnl.com/blog/smart-playlists
- Import/export (`settings.yml` + `.liquid`) : https://help.trmnl.com/en/articles/10542599-importing-and-exporting-private-plugins
- Sleep Mode : https://help.trmnl.com/en/articles/11129379-sleep-mode
- IPs serveurs TRMNL (allowlist) : https://trmnl.com/api/ips
- trmnlp, dev local : https://github.com/usetrmnl/trmnlp
- API SHOM (marées, abonnement) : https://diffusion.shom.fr/services-numeriques/api-shom.html
- Portail marées SHOM : https://maree.shom.fr
- Open-Meteo : https://open-meteo.com
