# Plugin TRMNL — Kerbrise (salon Saint-Malo)

Affiche l'état de la maison (séjour en cours, prochaine arrivée, météo, mer, marées)
à partir du payload `https://kerbrise.fr/api/term`. Stratégie **polling**.

## Structure (projet `trmnlp`)

```
trmnl-plugin/
├── .trmnlp.yml        # config du serveur de dev local (non uploadé)
├── src/
│   ├── full.liquid    # markup de l'écran plein (source de vérité)
│   └── settings.yml   # définition du plugin (uploadé par `trmnlp push`)
└── README.md
```

## Workflow de dev recommandé (local, live reload)

Installe l'outil (au choix) :

```bash
# Option A — gem Ruby (démarrage le plus rapide, nécessite Ruby >= 3.4)
gem install trmnl_preview

# Option B — Docker (zéro setup local)
# voir la commande `docker run ... trmnl/trmnlp serve` ci-dessous
```

Lance le serveur depuis ce dossier :

```bash
cd trmnl-plugin
trmnlp serve        # http://localhost:4567
```

Le serveur fetch ta polling_url EN LIVE (kerbrise.fr/api/term), rend `full.liquid`
avec les vraies données, et recharge à chaque sauvegarde. Tu édites `src/full.liquid`,
tu vois le rendu instantanément. C'est ta boucle de dev.

Équivalent Docker (si pas de Ruby) :

```bash
cd trmnl-plugin
docker run --pull always -p 4567:4567 -v "$(pwd):/plugin" trmnl/trmnlp serve
```

## Déploiement vers TRMNL

```bash
trmnlp login        # une fois — sauvegarde ta clé dans ~/.config/trmnlp/config.yml
trmnlp push         # upload settings.yml + *.liquid
```

⚠️ Pour que `push` mette à jour LE MÊME plugin et n'en crée pas un nouveau à chaque fois,
`src/settings.yml` doit contenir un `id:`. Il est ajouté automatiquement si tu pars d'un
`trmnlp clone <name> <id>` (clone d'un plugin existant) ou `trmnlp pull`. Si tu démarres
de zéro, fais un premier `push`, récupère l'id côté TRMNL, puis `trmnlp pull` pour le
rapatrier dans settings.yml.

Ensuite, côté TRMNL : ajoute le plugin à un **Playlist** (sinon le device ne le rafraîchit
jamais), puis **Force Refresh** pour voir le rendu immédiatement.

## Alternative sans CLI (UI web)

Si tu ne veux pas de trmnlp : Plugins → Private Plugin → Strategy `Polling`,
Polling URL `https://kerbrise.fr/api/term`, GET. Puis Edit Markup → onglet **Full** →
colle le contenu de `src/full.liquid`. Boucle plus lente (Force Refresh manuel).

## Accès aux variables

Avec **une seule** Polling URL, les clés sont à la racine :
`{{ status }}`, `{{ stay.family }}`, `{{ tides.events }}`…
Si tu ajoutes une 2e URL, elles deviennent `{{ IDX_0.x }}`, `{{ IDX_1.x }}` —
il faudra adapter le template.

## Point d'attention — états autres qu'« occupied »

Le template gère trois cas : **occupied** + `stay` présent → séjour en cours ;
`stay` absent → « Maison libre » ; `next` absent → bloc prochaine arrivée masqué.

⚠️ À vérifier côté API : confirme que `/api/term` renvoie bien `stay: null` (et non
un objet vide ou une erreur) un jour creux. Le `{% if status == "occupied" and stay %}`
en dépend.

## Limites connues

- Écran N&B 800×480 (TRMNL OG). Pas de couleur ni de demi-teintes fiables.
- Si un `*_label` est `null`, certaines lignes afficheront un libellé partiel
  (ex. « · coucher »). Le plus robuste est de garantir des chaînes non-nulles côté API.
