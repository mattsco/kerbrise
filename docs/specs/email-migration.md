# Spec — Architecture email : rapatriement & durcissement (#28)

> **Statut** : ✅ Implémentée (14 juin 2026, v1.2.0) — voir note de réalisation ci-dessous
> **Type** : Chantier multi-sessions
> **Cible** : Avant le cycle de choix été (janvier 2027), couplé à #22b
> **Estimation** : ~2-3h sur 2-3 sessions
> **Dernière MAJ** : 2026-06-14 (livraison)
> **Source** : audit `docs/architecture/EMAIL_AUDIT.md` (2026-06-13)

---

## ✅ Note de réalisation (14 juin 2026)

Ce document reste le **dossier de conception** (le *pourquoi* des décisions). Le chantier a été livré en v1.2.0. Écarts entre le plan et le livré :

- **Livré conforme** : versioning des 4 Edge Functions + triggers + cron dans `supabase/functions/` et `db/migrations/` (0002-0005) ; déclenchement DB conservé ; bug timezone corrigé (`parseLocalDate`, `formatRange`, `todayInParis` dans `_shared/dates.ts`) ; `search_path` ajouté aux 3 relais ; couche `_shared/` (dates, html, families, recipients, templates) ; preview locale `_dev/preview.ts` (remplace les 3 modes test) ; suppression du filtre `last_sign_in_at` + des 4 comptes inactifs.
- **Ajouté hors plan initial** : 5ᵉ fonction `notify-reduced` (email « créneau raccourci », borne 3 mois côté trigger SQL — `db/migrations/0005`) ; refonte design des emails (gabarit « carte postale mer », image bandeau Saint-Malo) ; **digest restructuré en 3 parties** (changements / demandes en attente avec familles restantes / prochains séjours triés, max 3) ; minification HTML anti-clipping Gmail.
- **NON implémenté (reporté)** : la **checkbox admin « envoyer ou non »** (décision E ci-dessous, qui pilote `is_admin_created`). Le bypass `is_admin_created` existe et fonctionne au niveau trigger, mais aucune UI admin ne l'expose encore. À faire si le besoin se présente.
- **Renvoyé à la roadmap** : le **seuil de relance** du digest (« depuis X jours ») et le 2ᵉ producteur « choix été » (#22b) — voir `ROADMAP.md`, item sept-oct.

---

## ⚠️ Ce que cette spec corrige par rapport à sa version précédente

La version initiale de ce ticket reposait sur une **prémisse fausse**, invalidée par l'audit :

| Ancienne spec disait | Réalité (prouvée par l'audit) |
|---|---|
| "Migrer vers Resend" | **Déjà sur Resend** depuis le 20 mai 2026. Rien à migrer côté provider. |
| "une Edge Function" | **4 Edge Functions + 1 job pg_cron + 6 fonctions PG** de relais/marquage. |
| Déclencher via **Server Actions** | Le déclenchement par **trigger DB** est conservé (voir §3, décision tranchée). |
| "(?) bienvenue / reset password" | Emails d'**auth Supabase**, canal séparé sur SMTP défaut. Hors scope par défaut. |
| "faut-il un digest ?" | Le digest **existe déjà** (cron dimanche 11h UTC). Pas une question, un canal en prod. |
| 3 modes test `strong`/`debug-cci`/`normal` | **Abandonnés.** Remplacés par une preview locale (décision C). |

**Objectif réel de #28, reformulé :** rapatrier dans le repo Git la logique email qui vit aujourd'hui dans le dashboard Supabase (Edge Functions + triggers + cron), **sans changer le modèle de déclenchement**, corriger les bugs connus, supprimer la duplication, et se donner un moyen de prévisualiser les emails en dev.

---

## 1. Pourquoi on garde le déclenchement par trigger DB (décision d'architecture)

`[Probable]` C'est le point le plus important de la spec, et il renverse l'ancienne direction.

**Le problème de l'ancienne approche (Server Actions) :** Kerbrise a **deux chemins d'écriture** sur `bookings` (client-direct via RLS + Server Actions admin — dette #3.3 de `KERBRISE_REVIEW.md`). Si l'envoi d'email est déclenché depuis les Server Actions, alors **tout email dont l'écriture passe par le chemin client-direct ne part jamais**, silencieusement. Une demande créée/approuvée/annulée côté client → aucune notification.

**Pourquoi le trigger DB est supérieur ici :** un trigger se déclenche sur la mutation de la donnée elle-même, **quel que soit le chemin**. Il ne peut pas rater un événement. C'est la bonne propriété pour un système de notifications.

**La raison invoquée pour migrer ("débugger hors repo") ne nécessite pas de changer le déclenchement.** Elle se règle en **versionnant** `supabase/functions/` et `db/migrations/` dans le repo : commitables, reviewables, déployables en CI/CD. On gagne le versioning, les tests locaux et la preview **sans sacrifier** la garantie "aucun email manqué".

**Décision actée :** on versionne et on rapatrie l'existant. On **ne migre pas** vers les Server Actions.

---

## 2. Contrat : qui reçoit quoi, quand (état actuel = cible)

Six déclencheurs. C'est le contrat figé — toute modification future part de cette table.

| # | Déclencheur | Condition SQL | Destinataires | Edge Function |
|---|---|---|---|---|
| 1 | Nouvelle demande | INSERT, `status='pending'` | **3 chefs de famille** | `notify-new-booking` |
| 2 | Demande modifiée (dates) | UPDATE, repasse `pending` (dates changées) | **3 chefs de famille** | `notify-new-booking` |
| 3 | Approbation | UPDATE, `status → approved` | **Auteur + chef de sa famille** | `notify-decision` |
| 4 | Refus | UPDATE, `status → rejected` (1 refus suffit) | **Auteur + chef de sa famille** (+ commentaire) | `notify-decision` |
| 5 | Annulation créneau confirmé | UPDATE, `approved → cancelled` | **3 chefs de famille** | `notify-cancelled-approved` |
| 6 | Récap hebdo | cron dim. 11h UTC, si `changed_this_week` existe | **TOUS les utilisateurs** | `send-weekly-digest` |

**Aucun email n'est envoyé si :**
- `[Certain]` `is_admin_created = true` → les 6 triggers bypassent (bénéficiaire inclus). Voir décision A.
- `[Certain]` destinataire avec `last_sign_in_at = null` → filtré silencieusement. Voir décision B (ce filtre est **supprimé** par cette spec).
- `[Certain]` emails d'auth (connexion, reset password) → canal séparé, SMTP défaut Supabase, **hors de ces 6 déclencheurs**. Voir décision D.

---

## 3. Décisions tranchées

### Décision A — Checkbox admin "envoyer un email ou non"

`[Certain]` **Implémentation : la checkbox pilote `is_admin_created`, pas un paramètre des fonctions email.** Aucune des 4 Edge Functions ne lit `is_admin_created` — le bypass est 100% côté trigger PG. Donc :
- Checkbox **cochée** "envoyer l'email" → écrire `is_admin_created = false`
- Checkbox **décochée** → écrire `is_admin_created = true` (comportement actuel)

Le champ existe déjà et fait déjà exactement ça. **Rien à construire côté email**, juste exposer le flag (inversé) dans le formulaire de création admin.

⚠️ `[Certain]` **Effet de bord à accepter :** `is_admin_created=true` bypasse aussi les triggers `mark_*_this_week`. Donc "ne pas envoyer d'email" = **aussi "ne pas apparaître dans le digest hebdo"**. Les deux sont couplés. Décision : **on accepte le couplage** (silencieux admin = silencieux partout). Découpler exigerait de séparer le flag en deux — non justifié pour 14 personnes.

### Décision B — Suppression du filtre `last_sign_in_at`

`[Probable]` **On supprime les 4 comptes inactifs (épouses des chefs jamais connectées) et on retire le filtre.**

Raisonnement : le filtre est une rustine permanente pour gérer 4 comptes temporaires. Son coût (un vrai nouveau membre ne reçoit aucun email tant qu'il ne s'est pas connecté — angle mort réel) est payé pour toujours. Supprimer les comptes règle le problème à la racine : chaque membre déclaré reçoit ses emails. Réintégration future = ajout du compte, notifications immédiates (comportement correct).

⚠️ **Contraintes de séquencement (non négociables) :**
1. `[Certain]` **Ordre obligatoire** : supprimer les 4 comptes **d'abord**, retirer le filtre du code **ensuite**. L'inverse spamme les 4 épouses au premier email.
2. `[Probable]` **Vérifier les FK avant suppression** : un compte `users` peut être référencé par `bookings.created_by` ou `approvals`. Si une de ces personnes a déjà figuré comme auteur/votant, le `DELETE` échouera ou cascadera. Vérifier `bookings`/`approvals` pour ces 4 `user_id` avant de supprimer. Ce n'est PAS un simple delete de 4 lignes.
3. `[Certain]` **Confirmer qu'aucune ne s'est connectée** (vérif `last_sign_in_at` sur les 4) avant suppression — 10 secondes, évite d'effacer un compte actif.

### Décision C — Preview locale (remplace les 3 modes test)

`[Probable]` **On abandonne `strong`/`debug-cci`/`normal`. On met une preview locale, zéro envoi.**

Pourquoi : le besoin réel est *"visualiser les emails avant qu'ils partent quand je fais des nouvelles versions"*. Les 3 modes *envoyaient* (vers `TEST_EMAIL`) sans rien *montrer* sans ouvrir la boîte mail. Une preview locale montre l'email dans le navigateur, dans toutes ses variantes, sans aucun envoi.

`[Certain]` **Note sur le "mode test qui spamme" :** ce n'est PAS un bug de code. Les 4 fonctions appliquent correctement `TEST_MODE ? [TEST_EMAIL] : realEmails`. Le check est `Deno.env.get('EMAIL_TEST_MODE') === 'true'` (strict). Si "ça spamme en test", c'est que la variable d'env ne vaut pas exactement la chaîne `'true'` dans l'environnement des Edge Functions (absente, ou `true` booléen, ou `1`). **Problème de config d'env, pas de logique.** La preview locale rend ce flag obsolète de toute façon.

**Forme de la preview :** une fois les templates rapatriés comme fonctions pures `(data) => html` (voir §4), une page/route dev (`/dev/email-preview` ou un script Node) rend chaque template avec des données fictives. Couvre les variantes : approuvé/refusé, avec/sans commentaire, modification vs création. Itération instantanée, zéro envoi, ne touche aucune boîte mail.

### Décision D — Périmètre auth (SMTP)

`[Certain]` **Hors scope de #28 par défaut.** Les emails d'auth (lien magique, reset password) partent du **SMTP défaut Supabase** (`@mail.app.supabase.io`, ~3-4 mails/h, custom SMTP désactivé — confirmé). C'est un canal distinct des 6 déclencheurs applicatifs.

`[Probable]` **À reconsidérer si** la suppression des comptes inactifs (décision B) implique de ré-inviter des gens : l'invitation passe par ce SMTP limité. Si tu onboardes plusieurs personnes le même soir, les liens peuvent se faire throttler. **Option différée** (ticket séparé) : activer le SMTP custom Resend pour l'auth (host `smtp.resend.com`, même domaine vérifié, ~15 min) → unifie l'expéditeur sur `@kerbrise.fr` et lève la limite. Pas dans #28 sauf si l'onboarding le force.

---

## 4. Bugs & dette à corriger pendant le rapatriement

Tant que les fonctions sont ouvertes, on corrige ce que l'audit a prouvé :

1. `[Certain]` **Bug timezone — présent dans les 4 fonctions.** Toutes utilisent `new Date(iso).toLocaleDateString(...)` (parse UTC). Une date `2026-02-15` peut s'afficher `14 février` dans un mail envoyé en UTC. **Touche TOUS les emails**, pas seulement la page `demandes` (≈ bug #2/#3). → remplacer par un `parseLocalDate` partagé. Occurrences : `notify-cancelled-approved`×2, `send-weekly-digest`×2, `notify-decision`×1, `notify-new-booking`×1.

2. `[Certain]` **Helpers dupliqués.** `formatDate` et `escapeHtml` redéfinis dans les 4 fichiers ; `formatShort` dans 2 ; `familyColorFor` dans le digest. → un module partagé `supabase/functions/_shared/` (Deno supporte les imports relatifs entre fonctions). Dé-duplication d'existant, pas d'abstraction nouvelle.

3. `[Certain]` **Squelette HTML répliqué** (header `🏡 Kerbrise`, CTA, footer `Mode test/Production`) dans les 4. → un layout partagé dans `_shared/`. Les corps spécifiques restent par fonction.

4. `[Certain]` **3 sources de couleurs famille** : `familyColorFor` hardcodé (digest) + `families.color` (DB, lu par jointure) + `lib/families.ts` (app). → une seule source. `[Hypothèse]` La DB est la plus logique (déjà lue partout) ; à confirmer que les valeurs concordent avant de supprimer les hardcodes.

5. `[Certain]` **3 fonctions relais sans `search_path` fixé** (`call_notify_new_or_modified`, `call_notify_decision`, `call_notify_cancelled_approved`). En SECURITY DEFINER c'est un risque d'injection de search_path. Les fonctions de marquage le fixent, pas celles de relais. → ajouter `SET search_path = public` en les versionnant.

**Hors scope #28** (tickets séparés, ne PAS traiter ici) :
- Retry / file d'envoi sur échec Resend (point ouvert §6).
- Table `email_log` (point ouvert §6).
- Abstraction "provider" pour changer de Resend — **non**, on vient d'y arriver, pas de flexibilité spéculative.

---

## 5. Architecture cible (versionnée dans le repo)

```
supabase/
├── functions/
│   ├── _shared/                    ← NOUVEAU. Code commun, fini la duplication
│   │   ├── dates.ts                  parseLocalDate, formatDate, formatShort (timezone OK)
│   │   ├── html.ts                   escapeHtml + layout Kerbrise (header/CTA/footer)
│   │   ├── families.ts               couleurs depuis 1 source
│   │   └── recipients.ts             logique destinataires (SANS filtre last_sign_in_at)
│   ├── notify-new-booking/
│   ├── notify-decision/
│   ├── notify-cancelled-approved/
│   └── send-weekly-digest/
db/
└── migrations/                     ← NOUVEAU. Le backend enfin versionné
    ├── 0002_email_triggers.sql       les 3 call_notify_* (avec search_path fixé)
    ├── 0003_email_marking.sql        mark_*_this_week, reset_approvals_on_date_change
    └── 0004_weekly_digest_cron.sql   le job pg_cron

app/(dev)/email-preview/            ← NOUVEAU (ou script). Preview locale, zéro envoi
```

Templates = fonctions pures `(data) => html`, importées par les Edge Functions ET par la preview. Une seule définition, deux consommateurs.

---

## 6. Plan de migration (par session)

Chaque étape est indépendamment livrable. Ordre contraint par la décision B.

### Session 1 — Versionner l'existant + corriger timezone (~1-1.5h)
- Rapatrier les 4 Edge Functions dans `supabase/functions/` (telles quelles d'abord, juste sous Git).
- Exporter triggers/fonctions/cron PG dans `db/migrations/` (avec `search_path` fixé).
- Extraire `_shared/dates.ts` avec `parseLocalDate` → corrige le bug timezone dans les 4.
- **Vérifier** : déploiement CI fonctionne, un email de test s'affiche à la bonne date.

### Session 2 — Dédupliquer + preview locale (~1-1.5h)
- Extraire `_shared/html.ts` (layout), `_shared/families.ts` (couleurs 1 source), `_shared/recipients.ts`.
- Templates en fonctions pures.
- Page/script de preview locale rendant les 6 emails dans leurs variantes.
- **Vérifier** : preview affiche chaque template ; les 4 fonctions produisent un HTML identique à avant (sauf date corrigée).

### Session 3 — Nettoyage filtre + tests bout-en-bout (~1h)
- `[Certain]` **Dans l'ordre** : (1) vérifier FK des 4 comptes, (2) supprimer les 4 comptes, (3) retirer le filtre `last_sign_in_at` de `_shared/recipients.ts`.
- Checkbox admin `is_admin_created` dans le formulaire de création.
- Tests bout-en-bout des 6 déclencheurs.
- **Vérifier** : un membre fraîchement (ré)ajouté reçoit bien ses emails ; checkbox admin coupe/active l'envoi.

---

## 7. Lien avec d'autres features

- **#22b** (emails choix de période d'été) — se branche sur cette architecture une fois `_shared/` en place. Devient un 7ᵉ déclencheur dans la matrice §2. À faire après session 2.
- **#29** (Web Push) — après #28, en complément des emails (pas en remplacement).

---

## 8. Points ouverts (à trancher plus tard, PAS dans #28)

- **`email_log`** : garder une trace des envois en base pour debug/observabilité ? Résoudrait l'angle mort "on ne sait pas qui a reçu quoi". Ticket séparé.
- **Fiabilité d'envoi** : aujourd'hui un échec Resend est `console.error` + perdu, aucun retry. Le digest est le plus exposé (un échec = la semaine entière perdue, et `changed_this_week` est resetté juste après — ordre reset/échec à vérifier). Ticket séparé.
- **SMTP auth** (décision D) : activer Resend pour l'auth ? Dépend de l'onboarding post-suppression comptes.

---

## Liens

- Audit complet : `docs/architecture/EMAIL_AUDIT.md`
- Provider : Resend (déjà en place)
- Dette liée : `docs/architecture/KERBRISE_REVIEW.md` §3.3 (deux chemins d'écriture), §3.4 (backend hors repo)