# Kerbrise — Roadmap

> Ce qui reste à faire, par horizon. Pour les versions déjà livrées, voir `CHANGELOG.md`.
>
> **Principe de séquencement** : l'app dort entre juillet et octobre (toutes les résas été sont faites ; la prochaine vraie activité = planification 2027 entre novembre et février). La saison dicte les priorités, pas un ratio impact/effort abstrait.

---

## 🗓️ Juin 2026 — avant le départ en vacances

- **#26-lite Mode vacances lite** — **deadline 22 juin**. Carte sur le dashboard quand un séjour est en cours : liens météo / marées / température mer Saint-Malo, zéro appel API. La version complète (#26) viendra cet été. Spec embryonnaire `docs/specs/vacation-mode-home.md`. → **Prompt ci-dessous**.

## 🏖️ Été 2026 — sur place, rythme vacances

- **✅ #26 Mode vacances — fait (pas encore release)** : les conditions du jour (marées + coef, temp. eau, météo + coucher du soleil, tendance semaine) sont intégrées **dans la bannière contextuelle** (cas A/B), pas en widget (rejeté au design). Sources : cabaigne (eau), maree.info (heures marée), Open-Meteo (météo), tides.ts (coef). En `[Unreleased]` dans `CHANGELOG.md` ; détail dans `docs/specs/vacation-mode-home.md`.
  - **Reste éventuellement à faire** (sorti du périmètre #26) : (1) **fiabilité scrapers** — cabaigne/maree.info peuvent casser silencieusement ; ajouter un log d'échec au checkpoint #28 ; (2) **unifier les fragments restants** — décider si webcam + poubelles rejoignent la bannière (intégration in-place, pas de widget) ; (3) **événements** — non faits faute de source fiable, à ne ré-ouvrir qu'en curation admin manuelle.
- **#14 (évolué) Monitoring wifi par Raspberry Pi** : RPi sur place qui ping internet toutes les 5 min, statut wifi de la maison visible dans l'app. Côté app codable avant ; installation physique sur place. Le mot de passe wifi rejoint les infos pratiques d'À propos (l'ex-#14 « password en DB » est absorbé).
- **Documents & infos pratiques dans À propos** : manuels, assurance, infos d'arrivée — au fil de l'eau. C'est le rôle confirmé de la page À propos, pas d'une nouvelle surface.

## 🍂 Septembre–octobre 2026

- **Versionner le reste du backend** : RLS policies, state machine d'approbation, contraintes — dans `db/migrations/`. Les triggers/fonctions email + le cron sont déjà versionnés (#28, migrations 0001-0005) ; cet item couvre **le reste**, à ne pas dupliquer.
- **Weekly digest = relance des décisions en souffrance** (prérequis de #22b). Principe : *toute décision en attente d'un acteur identifié qui ne l'a pas prise est relancée chaque semaine.*
  - **Déjà livré (v1.2.0)** : la section « demandes en attente » du digest liste les demandes pending avec les familles qui doivent encore voter ; le digest part même s'il n'y a QUE des pendings.
  - **Reste à faire** : la notion de **seuil de relance** (le digest part chaque dimanche tant qu'un pending existe, sans « depuis X jours » — `[Hypothèse]` 3 jours avant la première relance), et le **2ᵉ producteur** « famille n'a pas choisi sa période été » (via #22b, janvier).
  - **Forme cible** : une liste typée de « pendings actionnables » `{ acteur, type, since }` sur laquelle le weekly itère. Une demande non votée et une période non choisie sont le même objet sous deux formes. ⚠️ **Ne pas sur-construire** : pas de registry ni de moteur de règles configurable.
  - **Bloque** l'activation janvier de #22b (qui est le 2ᵉ producteur).
- **Checkpoint #28 (fin octobre)** : forcer un weekly réel + vérifier les logs Resend avant la saison de planification. Le système aura tourné à vide tout l'été — c'est le vrai test d'allumage.
- **Export agenda** : dans `BookingDetailModal`, sur un séjour futur approuvé de sa propre famille, bouton « Ajouter à mon agenda » → lien Google Calendar + fichier .ics (~2h).
- **Instrumentation légère** : latence d'approbation, logs d'envoi — pour décider #29 sur données, pas sur intuition.
- **Découper `stats/page.tsx` (518 l.)** : séparer fetch / agrégation / rendu. **`admin/analytics/page.tsx` (848 l.) : refonte complète** plutôt que refactor incrémental, orientée instrumentation produit.

## ❄️ Janvier 2027

- **#22b ON** : activer les rappels « choix été » dans le weekly, pour la famille qui doit choisir et n'a pas encore choisi. C'est le 2ᵉ producteur de la liste de « pendings actionnables » (item sept-oct). Si cette liste existe et est testée d'ici là, l'activation = ajouter le producteur « choix été » + bascule du flag.
- **Décision #29 Web Push** : GO seulement si, malgré des emails fiables, la latence d'approbation mesurée reste >48h. Sinon on n'en parle plus — valeur concentrée sur 3 chefs, des emails fiables suffisent peut-être.

## 🤷 Un jour peut-être

- Carnet de maison / signalements — hors app pour l'instant, à revisiter si la demande émerge.
- Journal de séjour / livre d'or photos — pas convaincu, à revisiter.
- Accès invités lecture seule — si une vraie demande émerge ; coût RLS à chiffrer avant.
- **#25** Page admin « Config » pour éditer les flags `lib/config.ts` via UI — quand on aura 2-3 flags. Spec `docs/specs/config-page-admin.md`.
- **#30** Restructurer `/dashboard/admin` en hub — audience = 1 ; à ressortir seulement si l'admin actuel devient pénible. Spec `docs/specs/admin-hub-restructure.md`.

## ⛔ Décidé skippé

- **#4** Affichage visuel des overlaps dans CalendarDayCell — règle anti-overlap déjà en place côté front, fix purement défensif.
- **#9** RLS placeholder été côté Supabase — pas de hackers dans la famille, RLS protège déjà les queries.
- Module charges / dépenses — on ne fait pas Tricount : autre produit, générateur de conflits.
- Flux iCal abonnement auto-sync — inutile, l'export ponctuel (bouton agenda) suffit pour 14 users.
- **#23** Animations Stats (Framer Motion) — c'est du loisir, à faire pour le plaisir si l'envie vient, pas à planifier.

---

## 🎯 Prompt prêt à l'emploi

> Coller en début de session. Supprimer une fois la session faite.

### Mode vacances lite (#26-lite, deadline 22 juin)

```text
Feature : mode vacances lite (#26-lite). Deadline : déployé avant le 22 juin.
Scope volontairement minimal — la version complète (#26, APIs météo/marées/mer)
viendra cet été.

Besoin : quand un séjour est en cours à la maison, le dashboard affiche une carte
"vacances" : météo Saint-Malo, horaires des marées, température de la mer.
Version lite = liens sortants bien choisis, zéro appel API.
Les infos pratiques (wifi, manuels…) restent dans À propos — la carte lite ne porte
que météo / marées / mer.

Avant de coder :
1. Lis dashboard/page.tsx, lib/dashboard-banner.ts, lib/data/bookings.ts
   (+ ce qui te manque)
2. Présente-moi tes décisions d'archi avec reco et marqueurs de confiance :
   - condition d'affichage (séjour de MA famille en cours ? n'importe quel séjour
     en cours ? fenêtre J-2 avant arrivée ?)
   - emplacement (carte dédiée vs extension de la bannière contextuelle)
   - liens cibles exacts (météo / marées / temp. mer)
3. Attends mon GO, puis code en remplacements de fichiers complets
4. Clôture : CHANGELOG.md + docs/changelog.md (version famille) + zip

Contrainte : zéro impact sur le flow réservation/approbation.
```
