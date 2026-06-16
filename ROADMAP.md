# Kerbrise — Roadmap

> Ce qui reste à faire, par horizon. Pour les versions déjà livrées, voir `CHANGELOG.md`.
>
> **Principe de séquencement** : l'app dort entre juillet et octobre (toutes les résas été sont faites ; la prochaine vraie activité = planification 2027 entre novembre et février). La saison dicte les priorités, pas un ratio impact/effort abstrait.

---

## 🏖️ Été 2026 — sur place, rythme vacances

> **#26 Mode vacances livré (v1.3.0, 16 juin)** — conditions du jour (marées + coef, temp. eau, météo + coucher du soleil, tendance semaine) dans la bannière contextuelle. La version « lite » de juin a été dépassée d'emblée par la version complète. Détail : `CHANGELOG.md` + `docs/specs/vacation-mode-home.md`. Restent les chantiers connexes ci-dessous.

- **Unifier les fragments « la maison maintenant »** : décider si la **webcam** et les **poubelles** rejoignent la bannière contextuelle (intégration in-place, pas de widget). Issu du périmètre élargi de #26.
- **Événements / sorties** : non faits faute de source fiable — à ne ré-ouvrir qu'en **curation admin manuelle** (#26 a tranché : pas de reco auto, risque d'info fausse).
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
- **Indicateur qualité de l'eau de baignade** : afficher un statut « eau OK / déconseillée » dans la bannière vacances **si on trouve une source fiable et exploitable** (piste : données « Qualité des eaux de baignade » du ministère de la Santé / ARS Bretagne pour les plages de Saint-Malo–Rothéneuf). À creuser ; pas de source confirmée à ce jour.
- **#25** Page admin « Config » pour éditer les flags `lib/config.ts` via UI — quand on aura 2-3 flags. Spec `docs/specs/config-page-admin.md`.
- **#30** Restructurer `/dashboard/admin` en hub — audience = 1 ; à ressortir seulement si l'admin actuel devient pénible. Spec `docs/specs/admin-hub-restructure.md`.

## ⛔ Décidé skippé

- **#4** Affichage visuel des overlaps dans CalendarDayCell — règle anti-overlap déjà en place côté front, fix purement défensif.
- **#9** RLS placeholder été côté Supabase — pas de hackers dans la famille, RLS protège déjà les queries.
- Module charges / dépenses — on ne fait pas Tricount : autre produit, générateur de conflits.
- Flux iCal abonnement auto-sync — inutile, l'export ponctuel (bouton agenda) suffit pour 14 users.
- **#23** Animations Stats (Framer Motion) — c'est du loisir, à faire pour le plaisir si l'envie vient, pas à planifier.
