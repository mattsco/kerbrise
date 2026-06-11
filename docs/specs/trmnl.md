# Spec — Écran TRMNL « Séjour » + API snapshot

> **Statut** : 🚧 Draft v0.2 — Q1/Q2 arbitrés ; Q3–Q6 ouverts
> **Créée** : 11/06/2026 · **Cible** : v1.2.x · **Backlog** : #32 [Hypothèse — numéro à confirmer]
> **Dépendances** : aucune bloquante. Synergie forte avec #26 (Mode vacances). #14 (WiFi en DB) : contourné en v1 par env vars.
>
> **Historique** : v0.1 (11/06) draft initial · v0.2 (11/06) arbitrages Q1 (contenu élargi : poubelles, météo, marées/coef, WiFi) et Q2 (transit cloud TRMNL accepté) ; phasage v1/v1.1 ; D12–D15.

---

## 1. Contexte & objectif

Un TRMNL OG (e-ink 7,5", 800×480) sera installé dans la maison de Saint-Malo. Il affiche en continu l'état « séjour » : qui occupe la maison, qui arrive ensuite, infos pratiques du jour (poubelles, WiFi, et en v1.1 météo + marées).

**Relation avec #26 (Mode vacances)** : #26 n'est pas spécifié. Cette spec définit donc le **contrat de données séjour**, qui vivra dans `lib/data/sejour.ts` et sera consommé par (a) la route TRMNL maintenant, (b) la page « Mode vacances » de la PWA plus tard. L'API HTTP, elle, est spécifique TRMNL.

**Garde-fou** : ne pas réduire le futur #26 à ce que l'e-ink sait afficher. Le snapshot est un sous-ensemble ; la PWA pourra l'enrichir (couleurs, interactions, météo riche…).

**Point ouvert** : « prochain guest » (Q5) — concept à définir avant spécification.

---

## 2. Le device — faits vérifiés (11/06/2026)

| Fait | Détail | Conséquence pour Kerbrise |
|---|---|---|
| Écran | 7,5", 800×480, monochrome (4 niveaux de gris sur les unités récentes) | Pas de couleur → le code couleur famille n'existe pas ici |
| Modèle de données | Plugin privé « polling » : **les serveurs TRMNL** appellent l'URL, injectent le JSON dans un template Liquid, rendent l'image ; le device se réveille et récupère l'image | kerbrise.fr n'est jamais contacté par le device ; les données transitent et sont stockées chez TRMNL (accepté — Q2) |
| Fraîcheur | `refresh_interval` du plugin : 15 / 60 / 360 / 720 / 1440 min ; le device a son propre rythme de réveil | Données affichées potentiellement vieilles d'1 h (reco : 60 min) |
| Auth sortante | Champ « polling headers », format `authorization=bearer xxx` | Auth par token, zéro firmware à toucher |
| Allowlist IP | IPs des serveurs TRMNL publiées sur `trmnl.com/api/ips` | Défense en profondeur possible (optionnel, v1.1) |
| Sleep Mode | Plage horaire fixe (ex. 22h–6h) réglée dans les settings device ; supprime les réveils sur la plage, gain d'autonomie significatif. Pilotable à distance via l'API device TRMNL (utilisée par l'intégration Home Assistant) | Lever batterie réel = réduire les réveils, pas « éteindre l'image » (voir D14) |
| Versionnage template | Export/import zip (`settings.yml` + `.liquid`) ; CLI `trmnlp` (Ruby/Docker) : `serve`, `push`, `pull`, `lint` | Le template peut vivre dans le repo (`trmnl/`) — répond au risque « backend hors repo » (review §3.4) |
| Échec de poll | Le device garde le dernier écran ; échecs répétés → plugin « degraded », refresh possiblement stoppés (reset manuel) | Pas de page blanche chez la famille, mais prévoir test post-panne |
| Batterie | 1800 mAh, autonomie de l'ordre de 1 à 3 mois selon le refresh | 60 min + sleep nocturne = bon compromis |

---

## 3. Décisions d'architecture

**D1 — Stratégie : plugin privé, polling.**
Rejeté *webhook* : « Jour x/y », « dans N jours », poubelles et marées changent chaque nuit **sans événement DB** → il faudrait un cron quotidien en plus de triggers sur bookings. Le polling couvre tout, zéro infra supplémentaire.
Rejeté *BYOS / génération d'image maison* : coût disproportionné pour 1 device (Q2 = oui a confirmé ce choix).

**D2 — Un seul endpoint : `GET /api/trmnl/sejour`.**
TRMNL merge un JSON unique dans le template ; le multi-URL existe mais ajoute des nœuds `IDX_n`. Le device ne dépend que d'un endpoint Kerbrise — c'est l'API qui agrège les sources externes (D12).

**D3 — Auth : `Authorization: Bearer ${TRMNL_API_TOKEN}`.**
Token ≥ 32 octets aléatoires (`openssl rand -hex 32`), stocké en env Vercel. Jamais en query string (logs). Rotation = changer l'env + le champ headers du plugin. Allowlist IP : v1.1 optionnel.

**D4 — Accès données via client Supabase service role : `lib/supabase/service.ts`, marqué `import "server-only"`.**
[Hypothèse] La service key n'est utilisée nulle part aujourd'hui — ce serait sa première introduction dans le codebase. Règle : importable uniquement depuis route handlers / server actions ; grep `SERVICE_ROLE` à chaque revue.
Rejeté *policy RLS pour anon* : exposerait les bookings à quiconque détient l'anon key (publique par construction).

**D5 — Logique dans `lib/data/sejour.ts` (`getSejourSnapshot()`), la route = vérif token + sérialisation.**
Réutilise le mapper bookings de `lib/data/bookings.ts` — pas de 7ᵉ copie de la requête (review §3.1). Signature alignée sur le style existant de `lib/data/` (à lire en étape 0).

**D6 — Le serveur formate, le template affiche.**
Toutes les chaînes (« 6 → 18 juin », « Jour 6/13 », « Coef 95 ») sont produites en TypeScript, donc testables et versionnées. Le Liquid ne porte quasi aucune logique (des `if` de présence de bloc, point). Raison : la logique hors repo est le risque n°1 de ce projet, comme du backend actuel.
Contrainte TRMNL : merge variables au **nœud racine** du payload (`stay`, `next`… à la racine, pas sous un wrapper `data`).

**D7 — Timezone : tout « aujourd'hui » calculé explicitement en Europe/Paris.**
Vercel tourne en UTC : entre ~22h/23h UTC et minuit, la date UTC est en retard d'un jour sur Paris → bascules de journée en retard à l'écran. Nouvelle helper `todayInParis()` dans `lib/dates.ts` (`Intl.DateTimeFormat` + `timeZone`). Interdit : `new Date().toISOString().slice(0, 10)`. Même famille de bug que `demandes/page` (review §5).

**D8 — Périmètre bookings : `approved` uniquement, fenêtre `[J−60, J+60]`.**
La borne basse couvre un séjour courant commencé il y a longtemps (durée max 60 j). Les `pending` n'ont rien à faire sur l'écran de la maison. Au plus un séjour courant si la contrainte d'exclusion est en prod [Hypothèse à confirmer — review §8.1] ; le code prend `min(start)` et logge toute anomalie.

**D9 — Route `force-dynamic`, mais sources externes cachées (voir D12).**
Un device, ~24 polls/jour : la requête Supabase à chaque poll est gratuite ; ce sont les appels externes qu'on cache.

**D10 — Middleware : `/api/trmnl/*` doit être hors du flux auth.**
[Hypothèse] Le matcher actuel couvre peut-être `/api` ; si oui, un poll sans cookie recevrait une redirection vers /login → du HTML dans le template. **Étape 0 = lire `middleware.ts`.**

**D11 — Template versionné dans le repo : `trmnl/` (`settings.yml` + `full.liquid`).**
Workflow A (idéal) : `trmnlp` — `serve` en local, `push` vers TRMNL. [Hypothèse] Ruby sous Termux : faisable en preview HTML (le rendu PNG exige Firefox + ImageMagick) — à tester. Workflow B (fallback Termux) : éditeur web TRMNL, export zip, commit. Dans les deux cas : **tout changement de schéma JSON ⇒ MAJ du template dans le même commit.**

**D12 — Sources externes (météo, marées) : agrégées par l'API Kerbrise, jamais par le template.** *(nouveau v0.2)*
Le template ne connaît qu'un seul schéma ; l'API fetche et met en cache : météo via `fetch(..., { next: { revalidate: 1800 } })`, marées une fois par jour (ou table statique, voir §7). Chaque source externe défaillante ⇒ champ `null`, bloc masqué — jamais d'erreur 500 à cause d'un tiers.
Météo : **Open-Meteo** (gratuit, sans clé, usage non commercial, lat 48.65 / lon −2.03). Marées : décision Q6 (§7).

**D13 — WiFi en v1 via env vars + QR code.** *(nouveau v0.2)*
`WIFI_SSID` / `WIFI_PASSWORD` en env Vercel ; payload QR standard `WIFI:T:WPA;S:<ssid>;P:<pass>;;`. Le QR est rendu par le template si faisable [Probable], sinon généré côté API en data-URI SVG. Migration vers la DB quand #14 sera fait — le contrat API ne changera pas.
Conséquence Q2 : le mot de passe WiFi résidera aussi chez TRMNL (accepté).

**D14 — « Écran éteint quand maison vide » : reformulé.** *(nouveau v0.2)*
[Certain] Un e-ink statique ne consomme presque rien ; la batterie part dans les réveils/refresh. « Éteindre l'image » ne gagne rien ; réduire les réveils, oui. En mode cloud, notre API ne pilote pas le rythme du device.
Retenu v1 : (a) écran « MAISON LIBRE » épuré quand `status = free` ; (b) **Sleep Mode nocturne natif** (plage fixe, ex. 23h–7h, réglage device) ; (c) interrupteur physique dans le rituel de fermeture de la maison.
v2 possible : cron Kerbrise qui active/désactive le Sleep Mode via l'API device TRMNL selon l'occupation (clé API + cron en plus — pas pour v1).

**D15 — Phasage.** *(nouveau v0.2)*
**v1 (semaine prochaine)** : séjour + prochaine arrivée + poubelles + WiFi/QR. Zéro dépendance externe, le device est en service.
**v1.1** : météo (Open-Meteo) + marées (selon Q6) + « guest » (selon Q5) + allowlist IP.
Le schéma JSON v1 inclut déjà les clés `weather` et `tides` à `null` → le template v1 est écrit une fois, les blocs apparaissent quand les données arrivent.

---

## 4. Contrat API

```
GET /api/trmnl/sejour
Authorization: Bearer <TRMNL_API_TOKEN>
```

### 200 — maison occupée (exemple : jeu. 11 juin 2026, pivot à venir, phase v1)

```json
{
  "generated_at_label": "jeu. 11 juin · 08:15",
  "status": "occupied",
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
  "weather": {
    "summary_label": "Éclaircies",
    "temp_label": "14° / 19°"
  },
  "tides": {
    "high_label": "PM 06:12 · 18:34",
    "low_label": "BM 00:48 · 13:02",
    "coef_label": "Coef 95"
  }
}
```

### 200 — maison libre

```json
{
  "generated_at_label": "mar. 30 juin · 07:45",
  "status": "free",
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

Règles :
- `next: null` si aucun séjour approuvé à venir → le template affiche « Aucun séjour prévu ».
- Tout bloc optionnel (`garbage`, `wifi`, `weather`, `tides`) peut être `null` → bloc masqué. Une source externe en panne ne casse jamais l'écran (D12).
- **401** `{"error":"unauthorized"}` — token absent ou invalide. **500** `{"error":"internal"}` — réservé aux erreurs Supabase/internes.
- ⚠️ Le schéma est un **contrat avec le template Liquid**, sans compilateur pour protéger le couplage. Renommer une clé = écran cassé silencieusement. Voir D11.

---

## 5. Écran v1 — mock 800×480

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
- **Niveau 2 — lecture rapprochée** : footer dense (poubelles, météo, marées) + QR WiFi (par nature un objet de proximité).

Identité famille sans couleur : nom en capitales + taille. Option v1.1 : motif ou bordure distinctif par famille (décision design du template, n'impacte pas l'API).
`generated_at_label` est indispensable : sur e-ink, un écran figé a l'air à jour — l'horodatage est le seul indice visible de panne.

---

## 6. Règles métier & edge cases

- **Séjour courant** : `start ≤ today < end` — bornes `[)`, cohérentes avec la contrainte d'exclusion. Conséquence jour pivot : à minuit, l'écran bascule sur la famille entrante ; la sortante disparaît. Option v1.1 : libellé « Les X partent ce matin ».
- **Prochaine arrivée** : premier booking `approved` avec `start > today`. Règle unique, valable maison occupée ou libre.
- **Jour x/y** : x = `today − start + 1`. y : **à trancher (Q3)** — jours pleins inclusifs (`end − start + 1`, reco) ou nuits (`end − start`). À aligner sur ce que la PWA affiche déjà.
- **« Dans N jours »** : `start − today` en jours civils Europe/Paris.
- **DST** : tester aux bascules (29 mars / 25 oct. 2026) — toute la chaîne passe par `todayInParis()`.
- **Jointures manquantes** (user/famille) : fallbacks du mapper existant.
- **Source externe en panne** : champ `null`, bloc masqué, log. Jamais de 500 causé par un tiers (D12).
- **Panne API Kerbrise** : le device garde le dernier écran ; échecs répétés → état « degraded » côté TRMNL, refresh possiblement stoppés. Post-incident : force refresh depuis le dashboard plugin.

---

## 7. Sourcing marées + coefficient (Q6 — décision requise)

Contexte vérifié (11/06/2026) :
- Le service officiel SHOM (« Marées à la carte » / SPM) fournit heures, hauteurs **et coefficients**, mais l'API nécessite un **abonnement payant** avec clé.
- Le portail public maree.shom.fr offre la consultation gratuite (≈ 10 jours glissants) ; la vignette gratuite est un widget HTML à intégrer, pas du JSON.
- maree.info interdit explicitement l'extraction automatisée (CGU).
- Le **coefficient est une donnée nationale** : calculé pour Brest, considéré équivalent de Dunkerque à Saint-Jean-de-Luz. Seules les heures PM/BM sont propres à Saint-Malo.

| Option | Description | Coût / risque | Verdict |
|---|---|---|---|
| **A** | API SHOM officielle (abonnement + clé) | Coût récurrent ; licence propre ; données de référence | Propre et automatique — si le coût est accepté |
| **B** | Vignette/portail SHOM gratuits, parsés | Gratuit | Parsing HTML fragile, hors usage prévu — **rejeté** |
| **C** | **Table annuelle statique committée** (`lib/data/tides-2026.json` : heures PM/BM Saint-Malo + coef) | Génération 1×/an (janvier) ; reproduction de prédictions SHOM = zone grise de licence, risque faible pour un affichage privé familial | **Reco** : zéro dépendance runtime, données exactes, ~40 Ko |
| **D** | API tierce mondiale (WorldTides, Stormglass…) pour les heures + table séparée pour le coef | Gratuit/low-cost ; pas de coefficient français nativement | Hybride bancal — solution de repli |

Reco : **C**. Rituel : régénérer le fichier chaque janvier (à ajouter au rituel de clôture annuel). Si tu préfères zéro maintenance manuelle : A.

---

## 8. Fichiers impactés

### v1

| Fichier | Statut | ~Taille |
|---|---|---|
| `lib/supabase/service.ts` | nouveau | 20 l. |
| `lib/data/sejour.ts` (+ types) | nouveau | 140 l. |
| `app/api/trmnl/sejour/route.ts` | nouveau | 40 l. |
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

`lib/external/` : nouveau dossier pour les sources non-Supabase — `lib/data/` reste réservé aux tables (règle du repo).

---

## 9. Sécurité & vie privée

- **Exposé** : prénoms, branche familiale, dates de présence et d'absence, SSID + mot de passe WiFi (v1, accepté via Q2). Pas d'email, pas de demandes pending, pas d'IDs internes.
- Une fuite de token expose un planning de présence (« la maison est vide du X au Y ») + le WiFi. Mitigations : token fort, rotation triviale, allowlist IP en v1.1.
- **Service role** : confiné à `lib/supabase/service.ts` + `server-only`, jamais importé dans un composant. La route ne prend aucun paramètre et ne renvoie que le snapshot — pas de passthrough.

---

## 10. Hors scope

Demandes pending · layouts half/quadrant · BYOS · page PWA #26 (consommera `getSejourSnapshot()` mais reste à spécifier) · pilotage automatique du Sleep Mode selon l'occupation (v2).

---

## 11. Questions ouvertes

- **Q3** — Sémantique « Jour x/y » : jours inclusifs (reco) ou nuits ?
- **Q4** — Numéro backlog : #32 ?
- **Q5** — « Prochain guest » : définition ? (type de résa invité ? champ bookings ? synonyme de « prochaine arrivée » ?) — bloque ce point uniquement.
- **Q6** — Sourcing marées : option A / C / D (§7) — reco C.

---

## 12. Plan d'implémentation

### v1 (semaine prochaine)

| # | Étape | Vérification |
|---|---|---|
| 0 | Lire `middleware.ts`, `lib/data/bookings.ts`, `lib/garbage-collection.ts`, `lib/dates.ts` | Hypothèses D4/D5/D10 + capacités réelles du module poubelles levées, ou spec amendée |
| 1 | `lib/supabase/service.ts` + env locales | Un select de test passe hors session utilisateur |
| 2 | `lib/data/sejour.ts` + `todayInParis()` | Partie pure (sélection, formatage) vérifiée sur 4 cas : occupé / libre / pivot / aucun séjour futur |
| 3 | Route + 401 + bloc WiFi/QR | `curl` sans token → 401 ; avec token → JSON conforme §4 |
| 4 | Exclusion middleware si besoin, déploiement | `curl` en prod OK |
| 5 | Plugin privé TRMNL (URL + header) + template `trmnl/` | Rendu trmnlp ou éditeur web conforme au mock §5, blocs null masqués |
| 6 | Device réel + Sleep Mode nocturne + test de panne (token invalide 1 h) | Écran correct ; comportement « degraded » compris |
| 7 | Clôture : spec → ✅, CHANGELOG, mémoire | — |

### v1.1

| # | Étape | Vérification |
|---|---|---|
| 8 | `lib/external/meteo.ts` (Open-Meteo, revalidate 1800 s) | `weather` non-null, ligne footer rendue, panne simulée ⇒ bloc masqué |
| 9 | Marées selon Q6 (si C : génération `tides-2026.json` + helper) | PM/BM/coef corrects vs maree.shom.fr sur 3 dates dont une grande marée |
| 10 | « Guest » selon Q5 | — |
| 11 | Allowlist IP (optionnel) | Poll TRMNL OK, curl hors IP → 403 |

Estimation : **v1 = S/M** (2 sessions : 0–4 puis 5–7) · **v1.1 = S** (option C) à **M** (option A).

---

## 13. Références

- Produit OG : https://shop.usetrmnl.com/collections/devices/products/trmnl
- Private plugins : https://help.trmnl.com/en/articles/9510536-private-plugins
- Import/export (`settings.yml` + `.liquid`) : https://help.trmnl.com/en/articles/10542599-importing-and-exporting-private-plugins
- Sleep Mode : https://help.trmnl.com/en/articles/11129379-sleep-mode
- IPs serveurs TRMNL (allowlist) : https://trmnl.com/api/ips
- trmnlp, dev local : https://github.com/usetrmnl/trmnlp
- API SHOM (marées, abonnement) : https://diffusion.shom.fr/services-numeriques/api-shom.html
- Portail marées SHOM (consultation) : https://maree.shom.fr
- Open-Meteo : https://open-meteo.com
