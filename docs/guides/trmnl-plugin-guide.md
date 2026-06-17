# Guide — Créer et implémenter une vue TRMNL

> **Type** : guide pratique (playbook), à rouvrir à chaque nouvelle vue TRMNL.
> **Créé** : 16/06/2026 · **Portée** : workflow dev local, auth, design, payload, debug, déploiement.
> **Complète** : `docs/specs/trmnl-sejour-display.md` (faits device, contrat de données, décisions produit).
> **Code de référence** : `trmnl-plugin/` (projet trmnlp), `app/api/term/route.ts` (payload), `lib/conditions.ts` + `lib/maree-info.ts` + `lib/tides.ts` (sources), `lib/supabase/service.ts`.
>
> **Pourquoi ce guide existe** : la 1ʳᵉ vue (« Séjour ») nous a fait perdre des heures sur des pièges non-évidents (syntaxe d'interpolation, Ruby, fuseaux horaires, blocage datacenter…). Tout est consigné ici pour que la prochaine vue prenne 1h, pas une journée. **Le §13 est le TL;DR** — si tu es pressé, lis-le en premier.

---

## 1. Modèle mental (rappel express)

- **Plugin privé, stratégie « Polling »** : les **serveurs TRMNL** appellent ton URL, injectent le JSON dans un template **Liquid**, rendent une **image**, que le device récupère à son réveil. `kerbrise.fr` n'est jamais contacté par le device. (Détails device : voir la spec.)
- **Écran** : TRMNL OG, **800×480, 1-bit N&B**. Pas de couleur, demi-teintes via dithering. Devise du design system : **« less is more »**.
- **Accès aux variables** : avec **une seule** Polling URL, les clés JSON sont **à la racine** (`{{ status }}`, `{{ stay.family }}`). Avec **plusieurs** URLs, elles deviennent `{{ IDX_0.x }}`, `{{ IDX_1.x }}`.
- **Fraîcheur = DEUX réglages distincts, souvent confondus** (cf. **§11**) : le **Refresh Rate du *device*** (à quelle fréquence l'écran se réveille et check-in) et le **Max refresh rate du *plugin*** (plafond on-demand : re-poll **uniquement** au check-in du device, jamais plus souvent que le plafond). **Il n'y a pas de cron serveur.** Fraîcheur réelle ≈ `max(intervalle device, plafond plugin)`. Ne jamais concevoir une vue qui suppose une mise à jour à la minute (ex. : ne pas afficher une horloge).

---

## 2. Structure d'un projet de vue (`trmnl-plugin/`)

Projet `trmnlp` (versionné dans le repo) :

```
trmnl-plugin/
├── .trmnlp.yml        # config du serveur de dev LOCAL — jamais uploadé
├── src/
│   ├── full.liquid            # vue plein écran (notre usage principal)
│   ├── half_horizontal.liquid # (optionnel) mashup
│   ├── half_vertical.liquid   # (optionnel)
│   ├── quadrant.liquid        # (optionnel)
│   ├── shared.liquid          # (optionnel) markup réutilisable
│   └── settings.yml           # définition du plugin — UPLOADÉ par `trmnlp push`
└── README.md
```

Règle d'or : **`settings.yml` = source de vérité versionnée**. Éviter d'éditer dans l'UI TRMNL ET dans le repo en parallèle (ils se marchent dessus). Choisir le repo + `trmnlp push`.

---

## 3. Setup de l'environnement de dev local

> C'est l'étape qui a coûté le plus de temps. Suivre l'ordre.

### 3.1 Ruby (le piège macOS)

`trmnlp` (gem `trmnl_preview`) exige **Ruby ≥ 3.4**. macOS ne livre que **2.6** → `gem install` échoue ou installe hors PATH.

```bash
brew install ruby@3.4
# ruby@3.4 est "keg-only" : brew ne le met PAS sur le PATH automatiquement.
echo 'export PATH="/opt/homebrew/opt/ruby@3.4/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
ruby -v        # doit afficher 3.4.x ; which ruby => /opt/homebrew/opt/ruby@3.4/bin/ruby

gem install trmnl_preview
# Si "command not found: trmnlp" après l'install : le bin des gems n'est pas sur le PATH.
echo 'export PATH="/opt/homebrew/lib/ruby/gems/3.4.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Alternative sans Ruby — Docker** (zéro setup) :

```bash
cd trmnl-plugin
docker run --pull always -p 4567:4567 -v "$(pwd):/plugin" trmnl/trmnlp serve
```

### 3.2 Boucle de dev

```bash
cd trmnl-plugin
trmnlp serve          # http://127.0.0.1:4567  — live reload à chaque sauvegarde
```

Édite `src/full.liquid`, le navigateur se met à jour seul. **Ne clique pas sur « Poll »** si tu utilises des fixtures (cf. §5) — le poll live tente l'appel authentifié et logge des 401 sans conséquence.

### 3.3 Déploiement vers TRMNL

```bash
trmnlp login          # une fois — clé de COMPTE depuis trmnl.com/account
trmnlp push           # upload settings.yml + *.liquid
```

⚠️ **`settings.yml` doit contenir un `id:`** sinon `push` **crée un nouveau plugin à chaque fois** (doublons). Après le tout premier push : `trmnlp pull` (ou `trmnlp list` → copier l'id → l'ajouter à `settings.yml`). Ensuite les push mettent à jour le même plugin.

---

## 4. `settings.yml` — référence

```yaml
---
name: Kerbrise – Saint-Malo
strategy: polling
refresh_interval: 60          # = PLAFOND plugin, en minutes. UI : 5 | 10 | 15 | 30 | 60 (Hourly) | 120 | 240 | 360 (4×/j) | 480 (3×/j) | 720 (2×/j) | 1440 (1×/j). Cf. §11.
polling_url: https://kerbrise.fr/api/term
polling_verb: GET
polling_headers: 'authorization=Bearer {{ api_token | strip }}'   # voir §6 (syntaxe !)
no_screen_padding: 'no'       # 'yes' = edge-to-edge (quotes obligatoires)
dark_mode: 'no'               # 'no' = noir sur blanc (ce qu'on veut au salon)
id: 338311                    # ajouté après le 1er push — sinon doublons
custom_fields:
- keyname: api_token
  name: Token API Kerbrise
  field_type: password
  description: Token attendu par /api/term
```

---

## 5. Authentification & secrets — **LE gros piège**

L'endpoint `/api/term` est protégé par un Bearer token (il expose la présence/absence de la famille). Voici comment le câbler **sans se faire avoir** :

1. **Le token vit dans un `custom_field`** (`field_type: password`), jamais en dur dans `settings.yml` (qui part dans git ET chez TRMNL).
2. On le référence dans `polling_headers`.

### 5.1 ⚠️ La syntaxe est `{{ }}`, PAS `##{{ }}`

La doc TRMNL écrit **partout** `##{{ variable }}`. **Le `##` n'est PAS la syntaxe** : c'est l'**échappement de leur moteur de doc (GitBook)** pour afficher des `{{ }}` littéraux. La vraie syntaxe est `{{ }}` tout court.

- Mettre `##{{ api_token }}` envoie littéralement `Bearer ##<token>` → **401**.
- Bon header : `authorization=Bearer {{ api_token | strip }}`
- **Vérifier avec le bouton « Parse »** sous le champ Polling Headers dans l'UI : il doit afficher `{"authorization":"Bearer <token>"}` **sans `##`**.

### 5.2 Whitespace = 401 silencieux

Un espace/retour-ligne collé par accident dans la valeur du champ token → `Bearer <token> ` → 401, alors que le même token marche en `curl`. Deux protections, ceinture + bretelles :

- Côté template : `{{ api_token | strip }}`.
- Côté API : `.trim()` sur le token reçu avant comparaison (cf. `tokenValid` dans `app/api/term/route.ts`).

### 5.3 Test de référence (à faire AVANT d'accuser le plugin)

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  https://kerbrise.fr/api/term -H "Authorization: Bearer <token>"
# 200 = token+header OK, le souci est ailleurs (interpolation, écran périmé…)
# 401 = token ou API
```

---

## 6. Dev local SANS auth : les fixtures

`trmnlp` interpole les headers de polling en **Liquid pur** (`{{ }}`) et tente le vrai fetch. Plutôt que de gérer l'auth en local, on **court-circuite le fetch** : la clé `variables:` de `.trmnlp.yml` est **deep-mergée à la racine** des données (vérifié dans le source trmnl_preview 0.7.1, `Context#user_data`). On y injecte le payload entier → le template se rend **sans token, sans Poll, sans 401**, et on peut **tester tous les états** (occupé / libre / pivot) de façon déterministe.

```yaml
# .trmnlp.yml
watch: [src, .trmnlp.yml]
time_zone: Europe/Paris
variables:
  trmnl:
    user: { name: Matthieu, first_name: Matthieu }
  status: occupied
  stay:
    days_remaining: 12
    dates_label: "15 → 28 juin"
    departure_label: "jusqu'au 28 juin"
  # … reste du payload …
  tides:
    coef_label: "Coef 95"
    level_label: "Grande vive-eau"
    upcoming:
      - { type: PM, time: "21h05" }
      - { type: BM, time: "04h11" }
```

> Pour tester l'état « maison libre » : passer `status: vacant` et commenter `stay:`. **Toujours tester l'état vide avant de déployer** — c'est l'écran qui s'affichera précisément quand la maison est inoccupée.

---

## 7. Design — règles du framework

- **« Less is more ».** S'appuyer sur les **composants natifs** et la **typographie**, pas sur des décorations. Références : `trmnl.com/framework` + exemples (Days Left, Weather, Stock, Shopify).
- **Pas d'illustrations maison.** (On a essayé un SVG de la maison → moche. Le N&B 1-bit pardonne mal le dessin amateur.) Jouer la hiérarchie typographique.
- **Classes utiles** : `view view--full`, `layout`, `columns`/`column`, `item`, `value` (+ `value--xxlarge|xlarge|large|tnums`), `label` (+ `label--small`, `label--gray-2/3`), `title`, `description`, `title_bar`, bordures `b-h-*`, gris `bg-gray-1..7`.
- **Piège** : un `<div class="meta"></div>` **vide** rend des **barres pointillées** disgracieuses. Ne pas laisser de `meta` vide.
- **Police Inter** : l'inclure pour matcher le rendu de l'éditeur (`fonts.googleapis.com/css2?family=Inter…`).
- **`title_bar`** en bas. On peut omettre l'`instance`/l'horodatage (la vue ne se rafraîchit pas à la minute de toute façon).
- **Hero typographique** : un gros chiffre (`value--xxlarge`) marche très bien pour l'info à lire d'un coup d'œil — mais attention au **sens** (un compte à rebours « 12 jours restants » peut être anxiogène ; à arbitrer selon la vue).

---

## 8. Conception du payload côté API (`/api/term`)

> Principe directeur : **le template affiche, l'API décide.** Le Liquid doit rester bête.

- **Labels pré-formatés côté serveur** (`"15° / 19°"`, `"jusqu'au 28 juin"`). Le template ne fait pas de calcul.
- **Dégradation gracieuse** : une source en panne → `null` / `[]`, **jamais de 500**. Le template masque la ligne (`{% if … %}`) ou affiche un repli (« Horaires indisponibles »).
- **Gérer TOUS les états** dans le template : occupé / libre / pivot. Tester l'état vide (§6).
- **Ne JAMAIS calculer du temps-relatif dans le template.** Exemple vécu : « prochaine marée ». Le serveur TRMNL tourne en **UTC**, ta machine locale en **Europe/Paris** → le même calcul Liquid donne 2h d'écart selon l'environnement. **L'API connaît l'heure** : elle expose des champs déjà **ordonnés/filtrés** (ex. `tides.upcoming`, trié, marées futures uniquement), le template se contente de boucler dessus.

Snippet template correspondant (consomme un champ déjà trié) :

```liquid
{% if tides.upcoming and tides.upcoming.size > 0 %}
  {% for e in tides.upcoming limit: 3 %}
    {% if e.type == "PM" %}Pleine ▲{% else %}Basse ▼{% endif %} {{ e.time }}
  {% endfor %}
{% elsif tides.next_label %}
  {{ tides.next_label }}
{% else %}
  Horaires de marée indisponibles
{% endif %}
```

---

## 9. Vérifier & débugger (workflow)

| Outil | Usage |
|---|---|
| **Edit Markup → « Your Variables »** | Montre **exactement** ce que le poll a ramené (ou `error: "unauthorized"`). Premier réflexe de debug. |
| **Bouton « Parse »** (champ Polling Headers) | Vérifie l'interpolation réelle du header (cf. §5.1, le piège `##`). |
| **Force Refresh sur la PAGE du plugin** | Force un **nouveau poll** côté serveur. ≠ **bouton physique du device**, qui ne fait que récupérer le **dernier écran déjà généré** (→ on voit un écran périmé si on n'a pas Force Refresh côté serveur après un changement). |
| **`curl … -H "Authorization: Bearer …"`** | Tester l'endpoint **avant** d'accuser le plugin (§5.3). |
| **Display API** | Récupérer le PNG rendu **sans device** : `curl https://trmnl.com/api/current_screen -H "Access-Token: <device-key>"` → `image_url`. `/api/display` **avance la playlist** ; `/api/current_screen` **lit** seulement. |

Pièges Display API :
- L'`image_url` est une **URL S3 signée qui expire en 300 s** — ne pas la stocker, la re-demander.
- Dans le JSON, les `&` sont échappés en `&` → **ne pas copier l'URL à la main**, passer par `jq` :
  ```bash
  curl -s "$(curl -s https://trmnl.com/api/current_screen -H 'Access-Token: <key>' | jq -r '.image_url')" -o /tmp/trmnl.png && open /tmp/trmnl.png
  ```
- Le `xargs -I{}` de macOS a une limite de longueur de ligne → l'URL signée la dépasse. Utiliser `$(...)`, **pas `xargs`**.

---

## 10. Checklist de déploiement

- [ ] `trmnlp push` (settings.yml a un `id:` → pas de doublon).
- [ ] Saisir le token dans le champ custom (UI) — **sans espace** ; vérifier via « Parse ».
- [ ] `dark_mode: no`, `no_screen_padding` selon le besoin.
- [ ] **Ajouter le plugin à un Playlist du device** — sinon le device ne le sync **jamais**, même si l'écran se génère bien côté serveur.
- [ ] Force Refresh (page plugin) → vérifier « Your Variables » (données présentes, pas d'`error`).
- [ ] Vérifier le rendu réel via `current_screen` (PNG).
- [ ] Tester l'état vide / dégradé.
- [ ] Si l'endpoint est restreint par IP : autoriser les IPs TRMNL (`trmnl.com/api/ips`).

---

## 11. Configurer les refresh rates — **best practices**

> Vécu : « réglé sur hourly mais l'écran ne bouge pas depuis 2 h ». Cause = confusion entre les deux réglages ci-dessous. **Aucun cron serveur ne pousse l'image** ; tout est piloté par le **check-in du device**.

### 11.1 Les deux réglages (à ne PAS confondre)

| Réglage | Où | Ce qu'il contrôle | Libellé UI |
|---|---|---|---|
| **Refresh Rate** | page **device** | fréquence à laquelle l'écran **se réveille, check-in et tire** la dernière image. **C'est le vrai moteur** + le **driver de la batterie**. | « Adjust your refresh rate to optimize focus and battery life. » |
| **Max refresh rate** | page **plugin** | **plafond** : le serveur re-poll `/api/term` et regénère l'image **on-demand, au check-in du device**, jamais plus souvent que ce plafond. **Pas** un planificateur. | « Refreshes on-demand when your device checks in — no more often than the rate below. » |

Options Max refresh rate (plugin) : `1×/j` · `2×/j` · `3×/j` · `4×/j` · `Every 4 hrs` · `Every 2 hrs` · `Hourly` · `Every 30 mins` · `Every 15 mins` · `Every 10 mins` · `Every 5 mins`.

### 11.2 Règles qui découlent du modèle on-demand

- **Fraîcheur réelle ≈ `max(intervalle device, plafond plugin)`.** Le plus lent des deux gagne. Mettre le plugin à 5 min alors que le device check-in toutes les 3 h ne sert **à rien**.
- **Plugin plus fin que device = gaspillage** : le device retire la **même image en cache** entre deux check-in. **Device plus fin que plugin = gaspillage** : il réveille l'écran (batterie) pour retirer une image identique.
- **`trmnlp push` ≠ re-render.** Pousser le markup ne regénère pas l'image ; tu vois l'ancien rendu jusqu'au prochain re-poll. **Force Refresh** (page plugin) force la régénération immédiate avec le markup à jour.
- **Choisir la fréquence selon la fraîcheur voulue de l'info « prochain X », pas selon la vitesse de changement de la donnée.** Les marées changent toutes les ~6 h, mais on veut que « prochaine marée » **roule** vite après qu'elle soit passée → un refresh à 6 h afficherait une marée déjà passée pendant des heures. **Hourly** garde l'info honnête à ≤1 h près.
- **Batterie** : le Refresh Rate **device** est le poste de coût. Sur batterie, fréquent = vidée en jours ; à l'heure = des mois. Sur **USB** (écran salon branché) : négligeable, va au plus fin utile.

### 11.3 Réglage retenu pour Kerbrise (écran salon)

- **Plugin Max refresh rate : `Hourly`.** Rien sur la vue ne bouge plus vite utilement (météo, coucher, séjour à minuit, marées qui roulent).
- **Device Refresh Rate : `30 min` si branché USB**, `Hourly` si sur batterie. (Device légèrement plus fin que le plafond plugin → l'écran récupère un nouveau rendu peu après sa génération.)

### 11.4 Débug « ça ne s'update pas » (couche par couche)

1. **Le device check-in ?** Page device → « last seen » / « Synced ». Vieux → souci réseau/sommeil/batterie, le plugin n'y est pour rien.
2. **Quelle image est servie ?** `current_screen` (§9) → timestamp du rendu. Vieux → poll serveur ne part pas ; récent mais écran device vieux → device ne tire pas.
3. **Le markup est-il live ?** « Edit Markup » contient bien ta dernière version ? Sinon re-`trmnlp push`. Puis **Force Refresh** pour régénérer.
4. **Repère visuel** : le `title_bar` affiche `MAJ {{ generated_at_label }}` → tu lis directement l'heure de génération du rendu courant sur l'écran.

---

## 12. Fiabilité des sources de données — **leçon importante**

> Vécu sur les **horaires de marée** : OK en local, **vides en prod**.

- **Les scrapers de sites qui bloquent les IP datacenter** (Cloudflare, etc.) marchent depuis ta machine (**IP résidentielle**) mais échouent en prod (**Vercel / Supabase edge = IP datacenter**). Cf. `lib/maree-info.ts` (scrape `maree.info`) et la note sea-temp dans `lib/conditions.ts`.
- **Un cron serveur ne sauve pas** si la source bloque les datacenters : le cron (Vercel ou edge function) tape dans le même mur.
- **Donnée déterministe → la committer offline.** Les **coefs** sont committés dans `lib/tides.ts` (« le + sûr ») ; les **horaires** suivent désormais le **même pattern** : `lib/data/tides-times-2026.ts` (généré, clé = date ISO, PM/BM + hauteur) + loader `lib/tides-times.ts`. `lib/conditions.ts` lit l'offline (`getOfflineTides`), plus de scrape `maree.info`. ✅ **Décision tranchée (option 2)** — source : office de tourisme Saint-Malo, récupéré 1×/an. Validation : les 682 coefs PM 2026 == `RAW_BY_YEAR[2026]` de `tides.ts` (séquence chronologique identique). Pour 2027 : `python3 scripts/tides/generate.py 2027` puis ajouter `TIDE_TIMES_2027` au registre. Année **2026 complète** (365 j, toutes hauteurs renseignées). _Reste : `app/api/tides/route.ts` (orphelin, sans consommateur) scrape encore en live — à supprimer ou rebrancher._
- Conséquence design : toujours prévoir le **repli `null`/`[]`** côté template pour ces sources fragiles.

---

## 13. Pièges rencontrés — TL;DR

| Symptôme | Cause réelle | Correctif |
|---|---|---|
| `command not found: trmnlp` | macOS = Ruby 2.6 ; `ruby@3.4` keg-only hors PATH | PATH `ruby@3.4/bin` **et** `gems/3.4.0/bin` dans `~/.zshrc` (§3.1) |
| `Custom Fields YAML syntax is invalid` | tabs au lieu d'espaces / pas de `-` / mauvaise indent | liste, 2 espaces, `-` en tête ; vide = valide |
| 401 alors que le token est bon | `##{{ }}` pris au pied de la lettre → `Bearer ##<token>` | syntaxe = `{{ }}` ; vérifier via « Parse » (§5.1) |
| 401 « marche en curl » | espace collé dans la valeur du champ token | `{{ api_token \| strip }}` + `.trim()` serveur (§5.2) |
| Écran périmé après un changement | bouton device ≠ re-poll serveur | Force Refresh sur la **page du plugin** (§9) |
| `Device not found` (Display API) | header `ID`/MAC non matché | n'envoyer que l'`Access-Token` |
| Marées « déjà passées » / ordre bizarre | calcul temps-relatif dans le template (fuseau UTC vs Paris) | l'**API** expose `tides.upcoming` déjà trié (§8) |
| Tuiles pointillées moches | `<div class="meta"></div>` vide | supprimer les `meta` vides (§7) |
| Données vides en prod, OK en local | source scrappée bloquée sur IP datacenter | committer la donnée offline (§12) |
| Plugin invisible sur le device | pas dans un Playlist | ajouter au Playlist (§10) |
| « Réglé sur hourly mais l'écran ne bouge pas » | confusion Refresh Rate (device) vs Max refresh rate (plugin) ; pas de cron serveur, tout est on-demand au check-in device | baisser le **Refresh Rate device** ; fraîcheur ≈ max(device, plafond plugin) (§11) |
| Nouveau markup poussé mais invisible | `trmnlp push` ≠ re-render ; le device retire l'ancienne image en cache | **Force Refresh** (page plugin) pour régénérer (§11.2) |

---

## 14. Références

- Spec produit & device : `docs/specs/trmnl-sejour-display.md`
- Projet de la 1ʳᵉ vue : `trmnl-plugin/`
- Payload : `app/api/term/route.ts` · sources : `lib/conditions.ts`, `lib/maree-info.ts`, `lib/tides.ts`
- Framework & exemples : <https://trmnl.com/framework> · <https://trmnl.com/framework/examples>
- Doc plugins privés : <https://help.trmnl.com/en/articles/9510536-private-plugins>
- Form builder (custom fields) : <https://help.trmnl.com/en/articles/10513740-custom-plugin-form-builder>
- Outil dev local `trmnlp` : <https://github.com/usetrmnl/trmnlp>
- Display API : <https://docs.trmnl.com/go/private-api/screens>
