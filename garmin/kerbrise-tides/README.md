# Marées Kerbrise — widget Garmin (FR255)

Widget Connect IQ qui affiche les marées de Saint-Malo sur la montre.
**Données embarquées, zéro réseau** : pas besoin du téléphone, fonctionne sur la plage.

- **Glance** (boucle de widgets) : prochaine marée d'un coup d'œil.
- **Vue plein écran** (ouverture du widget) : les 3–4 marées du jour, la prochaine surlignée.

Cible : **Forerunner 255 Small** (`fr255s`) — variantes `fr255`, `fr255m`, `fr255sm` aussi déclarées.

---

## ⚠️ Ce qui reste à faire (ne peut pas être fait depuis Cowork)

Le code est complet mais **n'a pas été compilé ni testé sur une montre** : la
compilation et le déploiement Garmin exigent le SDK Connect IQ + une clé
développeur + la montre branchée en USB. À faire sur ton Mac :

## 1. Installer l'outillage

1. Crée un compte développeur Garmin (gratuit) puis installe **Connect IQ SDK Manager** :
   https://developer.garmin.com/connect-iq/sdk/
2. Dans le SDK Manager : installe le dernier SDK **et** le device *Forerunner 255S*.
3. Installe **VS Code** + l'extension officielle **Monkey C** (éditeur Garmin).
4. Génère une **clé développeur** : VS Code → `Monkey C: Generate a Developer Key`
   (ou `openssl genrsa -out developer_key.pem 4096` puis conversion `.der`).

## 2. Compiler

Ouvre le dossier `garmin/kerbrise-tides/` dans VS Code, puis :

- `Monkey C: Build for Device` → choisir `fr255s` → produit un `.prg`.
- Ou tester sans montre : `Monkey C: Run` lance le **simulateur** (choisir Forerunner 255S).

En ligne de commande (depuis ce dossier) :

```bash
monkeyc -d fr255s -f monkey.jungle -o bin/KerbriseTides.prg -y /chemin/developer_key.der
```

## 3. Installer sur la montre (sideload)

1. Branche le FR255 en USB (mode stockage).
2. Copie le `.prg` généré dans le dossier `GARMIN/Apps/` de la montre.
3. Débranche. Le widget apparaît dans la boucle de widgets (paramétrable via
   *Garmin Connect → Widgets / Glances*).

Alternative : publier sur le **Connect IQ Store** (validation Garmin, puis install
depuis l'app mobile). Inutile pour un usage perso/famille.

---

## Mise à jour annuelle des marées

Les horaires sont figés pour **2026** (`source/TideData.mc`, généré). Pour 2027 :

1. Régénérer `lib/data/tides-times-2027.ts` (cf. `scripts/tides/generate.py`).
2. Regénérer les données packées :
   ```bash
   python3 scripts/garmin/generate_tide_data.py 2027
   ```
   ⚠️ Le script écrit **une seule année** dans `TideData.mc`. Pour couvrir plusieurs
   années sur la montre, il faudra étendre `TideData.mc` (tableau par année) — pas
   nécessaire tant que tu recompiles chaque année.
3. Recompiler et re-sideloader.

---

## Structure

```
garmin/kerbrise-tides/
├── manifest.xml                  # type=widget, products fr255*, aucune permission
├── monkey.jungle                 # config build
├── resources/
│   ├── strings/strings.xml        # nom de l'app
│   └── drawables/
│       ├── drawables.xml
│       └── launcher_icon.png      # icône 40×40 (vague) — remplaçable
└── source/
    ├── KerbriseTidesApp.mc         # entrée : getInitialView + getGlanceView (:glance)
    ├── KerbriseTidesGlanceView.mc  # vue compacte (prochaine marée)
    ├── KerbriseTidesView.mc        # vue plein écran (marées du jour)
    ├── TideLogic.mc                # date→jour, marées du jour, prochaine marée
    └── TideData.mc                 # GÉNÉRÉ — données packées (ne pas éditer)
```

## Format des données packées (`TideData.mc`)

20 caractères par jour, indexés par *(jour de l'année − 1)*. Une marée = 5 chars :
`[H|L|-]` (H=pleine mer/PM, L=basse/BM, -=absente) + `HHMM`. 4 marées max/jour.
Hauteur et coefficient sont volontairement **droppés** (l'app n'affiche que type +
heure) → ~7 Ko, tient dans le budget mémoire de la glance.

## Dépannage

- **"no compatible devices found"** au build → vérifier que le device 255S est bien
  installé dans le SDK Manager et que `fr255s` est dans `manifest.xml`.
- **La glance dépasse la mémoire** (rare ici) → dans `monkey.jungle`, ajouter des
  `base.excludeAnnotations` et annoter `TideData`/`TideLogic` avec `(:glance)` pour
  ne charger que le nécessaire dans le périmètre glance.
- **Heures fausses** → la montre utilise son fuseau local ; régler le FR255 sur
  l'heure de Paris.

## Limite connue

Données = office de tourisme de Saint-Malo (mêmes sources que le reste de Kerbrise).
Prédictions, pas du temps réel ; aucune surcote météo prise en compte.
