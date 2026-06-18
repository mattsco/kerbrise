# Guide — Créer et implémenter une app Garmin (Connect IQ)

> **Type** : guide pratique (playbook), à rouvrir à chaque nouvelle app Garmin.
> **Créé** : 18/06/2026 · **Portée** : config machine, workflow build/sideload, pièges rencontrés, pattern données offline.
> **Code de référence** : `garmin/kerbrise-tides/` (1ʳᵉ app : widget marées), `scripts/garmin/generate_tide_data.py` (générateur de données packées).
> **Complète** : `docs/guides/trmnl-plugin-guide.md` (l'autre afficheur déporté de Kerbrise — TRMNL e-ink).
>
> **Pourquoi ce guide existe** : la 1ʳᵉ app (« Marées Kerbrise ») nous a coûté plusieurs allers-retours sur des pièges non-évidents (Java introuvable, device id, types de retour hérités, titre vide, scope glance). Tout est ici pour que la prochaine app prenne 1h, pas une après-midi. **Le §8 est le TL;DR.**

---

## 1. Modèle mental

- **Langage** : Monkey C (hybride Java/JS), compilé par `monkeyc` (outil Java) vers un `.prg`.
- **Types d'app** : `watchface`, `datafield` (pendant une activité), `widget` (boucle de widgets + glance), `app` (plein écran depuis le menu). Pour un afficheur consultable hors activité → **widget** (c'est notre choix).
- **Glance** : la vue compacte d'un widget dans le carrousel. Code annoté `(:glance)`. C'est l'usage principal sur une montre : un coup d'œil sans ouvrir l'app.
- **Réseau** : le FR255 **n'a pas de WiFi** → un `makeWebRequest` passe par le téléphone (Bluetooth + app Connect IQ Mobile). **Conséquence de design** : pour une donnée déterministe (marées, calendrier), on **embarque les données dans l'app** et on ne fait aucune requête → marche sans téléphone, zéro fragilité. Même philosophie qu'offline-first ailleurs dans Kerbrise.

## 2. Notre config machine (m3pro, validée le 18/06/2026)

- **SDK** : Connect IQ SDK + extension VS Code « Monkey C ». SDK Manager installe SDK + devices.
- **Java** : requis par `monkeyc`, **pas sur le PATH par défaut**. JDK présent ici :
  ```bash
  export JAVA_HOME=/Users/mattsco/Library/DataScienceStudio/Java/jdk-17.0.9+9/Contents/Home
  export PATH="$JAVA_HOME/bin:$PATH"
  # à ajouter dans ~/.zshrc pour le rendre permanent
  ```
  (Le SDK récent tourne sous **JDK 17**, pas 11.)
- **Clé développeur** (générée une fois, hors repo) :
  ```bash
  openssl genrsa -out /Users/mattsco/developer_key.pem 4096
  openssl pkcs8 -topk8 -inform PEM -outform DER -nocrypt \
    -in /Users/mattsco/developer_key.pem -out /Users/mattsco/developer_key.der
  ```
- **Montre** : Forerunner 255 Small **Music** → device id **`fr255sm`** (et NON `fr255s`).
  La source de vérité des ids = noms de dossiers dans
  `~/Library/Application Support/Garmin/ConnectIQ/Devices/`.

## 3. Build & sideload

```bash
export JAVA_HOME=/Users/mattsco/Library/DataScienceStudio/Java/jdk-17.0.9+9/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p bin
monkeyc -d fr255sm -f monkey.jungle -o bin/KerbriseTides.prg -y /Users/mattsco/developer_key.der
```

Sideload : montre en USB → copier le `.prg` dans `GARMIN/Apps/` → débrancher.
**Premier build : préférer VS Code** (`Monkey C: Run` → simulateur) — gère Java/clé/device et permet de voir l'affichage avant le sideload. La ligne de commande sert pour les régénérations.

## 4. Structure d'un projet (`garmin/<app>/`)

```
garmin/kerbrise-tides/
├── manifest.xml          # type, id (unique!), products, permissions
├── monkey.jungle         # config build (project.manifest = manifest.xml)
├── resources/
│   ├── strings/strings.xml      # AppName
│   └── drawables/
│       ├── drawables.xml
│       └── launcher_icon.png    # icône menu
└── source/
    ├── <App>.mc                 # AppBase : getInitialView + getGlanceView (:glance)
    ├── <App>GlanceView.mc       # vue compacte (:glance)
    ├── <App>View.mc             # vue plein écran
    └── <logique + données>.mc
```

## 5. Pattern « données offline packées » (réutilisable)

Quand la donnée est déterministe et volumineuse (ici 365 jours de marées) :

1. Un script Python (`scripts/garmin/generate_tide_data.py`) lit la source committée
   (`lib/data/tides-times-<an>.ts`) et écrit un module Monkey C `TideData.mc`.
2. **Encodage à largeur fixe** indexé par clé calculable (jour de l'année) →
   lookup O(1) par `substring`, **sans parser de JSON** (économe en mémoire).
   Format marée = 8 chars : `[H|L|-]` + `HHMM` + `CCC` (coef, "---" si absent).
3. Garder le strict nécessaire à l'affichage (on a droppé hauteur d'eau).
4. **Refresh annuel** : régénérer la source puis
   `python3 scripts/garmin/generate_tide_data.py <année>`, recompiler, re-sideloader.
   ⚠️ Le script n'écrit qu'**une** année ; pour en couvrir plusieurs il faudrait
   un tableau par année dans `TideData.mc`.

## 6. Pièges rencontrés (et corrigés)

- **« Unable to locate a Java Runtime »** → Java pas sur le PATH (cf. §2), pas absent.
- **« Invalid device id »** → device pas installé dans le SDK Manager, ou mauvais slug.
  Vérifier les dossiers dans `.../ConnectIQ/Devices/`.
- **« Cannot override … with a different return type »** → ne PAS typer le retour des
  méthodes héritées d'`AppBase` (`getInitialView`, `getGlanceView`). Les laisser sans
  annotation `as ...`.
- **Titre vide sous l'icône dans le menu** → bloc `<iq:languages>` déclaré sans chaînes
  localisées (`resources-fre/`, `resources-eng/`). **Supprimer le bloc langues** et
  laisser `resources/strings.xml` par défaut couvrir toutes les langues.
- **Scope glance** : tout le code compile dans tous les scopes par défaut. Si la glance
  dépasse la mémoire, ajouter `base.excludeAnnotations` dans `monkey.jungle` et annoter
  les modules partagés `(:glance)`.
- **Flèches/icônes** : les polices Garmin n'ont pas toujours les glyphes ▲▼ → dessiner
  des triangles avec `dc.fillPolygon(...)` plutôt que des caractères.
- **Fuseau horaire** : `Gregorian.info(Time.now(), …)` utilise le fuseau **de la montre**.
  Régler le FR255 sur l'heure de Paris.

## 7. Affichage (rappels Dc utiles)

- `dc.getWidth()/getHeight()`, `dc.getTextWidthInPixels(txt, font)`, `dc.getFontHeight(font)`
  pour positionner précisément (ex. flèche alignée sur le texte).
- Polices : `FONT_GLANCE` (glance), `FONT_TINY/XTINY/SMALL/MEDIUM` (plein écran).
- Couleurs nommées : `COLOR_BLUE`, `COLOR_YELLOW`, `COLOR_LT_GRAY`, `COLOR_DK_GRAY`…
- Justif : `TEXT_JUSTIFY_CENTER | TEXT_JUSTIFY_VCENTER`, etc.

## 8. TL;DR — nouvelle app en 1h

1. `export JAVA_HOME=…/jdk-17.0.9+9/Contents/Home` + PATH (ou via VS Code).
2. Copier `garmin/kerbrise-tides/` comme squelette ; **générer un nouvel `id`** dans
   `manifest.xml` (`python3 -c "import uuid;print(uuid.uuid4().hex)"`).
3. `type` adapté (widget pour un afficheur), products = `fr255sm`, **pas de bloc langues**.
4. Données déterministes → pattern §5 (script Python → module packé).
5. Ne pas typer le retour des méthodes héritées ; flèches en `fillPolygon`.
6. Dév au **simulateur** (VS Code), puis `monkeyc -d fr255sm … -y …/developer_key.der`,
   puis sideload dans `GARMIN/Apps/`.
