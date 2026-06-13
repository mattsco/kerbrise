# Audit infra email — état actuel

> **Statut** : Constat (état actuel uniquement). Ne contient PAS la cible #28.
> **Date** : 2026-06-13
> **Méthode** : 7 sorties brutes (triggers, fonctions PG, cron, webhooks, code Edge Functions, logs Resend, SMTP). Dumps bruts archivés hors repo, non commités. Le point 7 (SMTP), initialement vide, a été vérifié manuellement dans le dashboard Supabase (voir §4).
> **Convention de confiance** : `[Certain]` = prouvé par les données ; `[Probable]` = déduction forte ; `[Hypothèse]` = comblement de lacune.

---

## 0. Verdict en une phrase

`[Certain]` Les 3 versions du changelog/review se réconcilient ainsi : **il n'existe AUCUN trigger Postgres qui envoie un email directement.** Tous les emails partent de **4 Edge Functions Deno appelant l'API Resend**. Les triggers PG ne font que **déclencher** ces fonctions via `net.http_post`. La "version trigger Postgres inféré" de la review est donc à moitié juste (il y a bien des triggers) et à moitié fausse (ils n'envoient rien, ils relaient).

---

## 1. Carte exacte : événement → mécanisme → email → destinataires

Quatre canaux d'envoi. Trois sont event-driven (trigger PG → Edge Function), un est planifié (cron → Edge Function).

### Canal 1 — Nouvelle demande / demande modifiée

| | |
|---|---|
| **Déclencheur** | `[Certain]` Trigger `trigger_new_or_modified` sur `bookings` (AFTER INSERT **et** AFTER UPDATE) → fonction `call_notify_new_or_modified()` |
| **Condition INSERT** | `[Certain]` `new.status = 'pending'` |
| **Condition UPDATE** | `[Certain]` repasse en pending : `new.status='pending'` ET `old.status<>'pending'` ET (dates changées) |
| **Bypass** | `[Certain]` Si `new.is_admin_created = true` → `return new`, aucun email |
| **Mécanisme** | `[Certain]` `net.http_post` → Edge Function `notify-new-booking` |
| **Email envoyé par** | `[Certain]` `notify-new-booking.ts` → `POST https://api.resend.com/emails` |
| **Destinataires** | `[Certain]` **Les 3 chefs de famille** (`is_family_head = true`), filtrés pour ne garder que ceux **déjà connectés au moins une fois** (`last_sign_in_at != null`). En `TEST_MODE`, redirigé vers `TEST_EMAIL` unique. |
| **Objet** | `[Certain]` `🆕 Nouvelle demande de la famille X` ou `🔄 Demande modifiée de la famille X` |

### Canal 2 — Décision (approbation / refus)

| | |
|---|---|
| **Déclencheur** | `[Certain]` Trigger `trigger_decision` sur `bookings` (AFTER UPDATE) → `call_notify_decision()` |
| **Condition** | `[Certain]` `old.status <> new.status` ET `new.status IN ('approved','rejected')` |
| **Bypass** | `[Certain]` `is_admin_created = true` → aucun email |
| **Mécanisme** | `[Certain]` `net.http_post` → Edge Function `notify-decision` |
| **Email envoyé par** | `[Certain]` `notify-decision.ts` → Resend |
| **Destinataires** | `[Certain]` **L'auteur de la demande + le chef de sa propre famille** (sans doublon), filtrés sur connectés uniquement. PAS les 3 chefs — ici c'est ciblé sur la famille concernée. |
| **Objet** | `[Certain]` `🎉 Demande approuvée : …` ou `❌ Demande refusée par la famille Y`. En cas de refus, le mail inclut le commentaire du **dernier** refus (`approvals` le plus récent `decision='rejected'`). |

### Canal 3 — Annulation d'une réservation confirmée

| | |
|---|---|
| **Déclencheur** | `[Certain]` Trigger `trigger_cancelled_approved` sur `bookings` (AFTER UPDATE) → `call_notify_cancelled_approved()` |
| **Condition** | `[Certain]` `new.status='cancelled'` ET `old.status='approved'` (uniquement l'annulation d'un créneau **déjà confirmé**) |
| **Bypass** | `[Certain]` `is_admin_created = true` → aucun email |
| **Mécanisme** | `[Certain]` `net.http_post` → Edge Function `notify-cancelled-approved` |
| **Email envoyé par** | `[Certain]` `notify-cancelled-approved.ts` → Resend |
| **Destinataires** | `[Certain]` **Les 3 chefs de famille**, filtrés connectés. Logique : un créneau se libère, tout le monde doit le savoir. |
| **Objet** | `[Certain]` `🚫 Annulation : X libère … → …` |

### Canal 4 — Récap hebdomadaire (weekly digest)

| | |
|---|---|
| **Déclencheur** | `[Certain]` **pg_cron** job `weekly-digest` (jobid 1), schedule `0 11 * * 0` = **chaque dimanche 11:00 UTC (13:00 Paris)** |
| **Mécanisme** | `[Certain]` Le cron exécute `net.http_post` vers l'Edge Function `send-weekly-digest`, avec le `service_role_key` lu depuis `vault.decrypted_secrets` |
| **Garde anti-bruit** | `[Certain]` Si aucun booking avec `changed_this_week = true` → la fonction sort sans envoyer (`'No changes, skipped'`) |
| **Email envoyé par** | `[Certain]` `send-weekly-digest.ts` → Resend |
| **Destinataires** | `[Certain]` **TOUS les utilisateurs** (`users` entier), filtrés connectés uniquement — pas seulement les chefs. |
| **Contenu** | `[Certain]` 3 sections de changements (nouvelles confirmations / modifications-réductions / annulations) + calendrier des 3 prochains mois groupé par famille |
| **Effet de bord** | `[Certain]` En fin d'envoi, **reset** `changed_this_week=false`, `previous_start_date=null`, `previous_end_date=null` sur toutes les lignes marquées. C'est ce qui arme le digest de la semaine suivante. |
| **D'où vient `changed_this_week`** | `[Certain]` Posé par 3 triggers BEFORE UPDATE : `mark_booking_approved_this_week` (pending→approved), `mark_booking_cancelled_this_week` (approved→cancelled), et `reset_approvals_on_date_change` (réduction de dates). Tous bypassés si `is_admin_created`. |

---

## 2. Schéma de bout en bout

```
ÉVÉNEMENT UTILISATEUR (insert/update bookings via client ou approvals)
        │
        ▼
TRIGGER POSTGRES (BEFORE: marque changed_this_week ; AFTER: relaie)
        │  net.http_post + Bearer service_role_key (depuis vault)
        ▼
EDGE FUNCTION DENO (notify-* / send-weekly-digest)
        │  lit la donnée, construit le HTML, filtre destinataires connectés
        │  POST api.resend.com/emails  +  Bearer RESEND_API_KEY
        ▼
RESEND → boîtes mail des destinataires

CANAL 4 : pg_cron (dim 11:00 UTC) remplace le trigger comme point de départ.
```

`[Certain]` Le `service_role_key` transite **deux fois** : (1) du trigger vers l'Edge Function (autorise l'appel de fonction), (2) la fonction l'utilise pour son propre `createClient` admin (listUsers, lecture cross-RLS). La clé Resend, elle, ne vit **que** dans l'environnement des Edge Functions, jamais en base.

---

## 3. Ce que les logs Resend prouvent (et contredisent)

`[Certain]` 38 envois entre le 2026-05-19 et le 2026-05-31, tous `response_status=200`. Deux signatures distinctes :

| Période | `user_agent` | `api_key_id` | Lecture |
|---|---|---|---|
| 19 mai (3 envois) | `resend-node:6.12.2` | **3 clés distinctes** | Sender **Node.js**, pas Edge. Phase de bootstrap/test. |
| 20 mai → 31 mai (35 envois) | `Deno/…SupabaseEdgeRuntime/1.74.0` | **1 clé stable** (`a78f1121…`) | Architecture Edge Function actuelle, en place depuis le 20 mai. |

**Conséquence pour la réconciliation des 3 versions :**
- `[Certain]` Le changelog 1.0.0 "Edge Function + Resend" est **vrai pour l'état final** mais **masque une première implémentation Node** (les 3 envois du 19 mai). Il y a donc eu une bascule Node → Edge *pendant* la fenêtre de lancement.
- `[Probable]` Les 3 clés API distinctes du 19 mai = tâtonnement de configuration (création/révocation de clés pendant les tests), pas un design multi-clés.

`[Certain]` Le seul envoi du 31 mai est à `11:00:07 UTC` un dimanche → correspond exactement au cron `0 11 * * 0`. **C'est le digest hebdo, et c'est la seule occurrence de digest dans la fenêtre.** Les autres pics (20–22 mai) sont du trafic event-driven de test.

`[Certain]` Les logs ne contiennent **aucune adresse destinataire** — pas de fuite PII dans ce dump. Ils ne disent pas non plus *quelle* fonction a émis quel envoi (l'`user_agent` Deno est identique pour les 4 fonctions). Donc la ventilation par canal au-delà du digest est `[Hypothèse]`.

---

## 4. Inventaire des objets (pour le futur versioning)

`[Certain]` Objets email-related, à terme à exporter dans `db/migrations/` :

**Fonctions PG (relais & marquage)**
- `call_notify_new_or_modified()` — SECURITY DEFINER, **PAS** de `search_path` fixé ⚠️
- `call_notify_decision()` — idem, pas de search_path ⚠️
- `call_notify_cancelled_approved()` — idem, pas de search_path ⚠️
- `mark_booking_approved_this_week()` — search_path = public
- `mark_booking_cancelled_this_week()` — search_path = public
- `reset_approvals_on_date_change()` — search_path = public (marque aussi le digest)

**Triggers**
- `trigger_new_or_modified` (INSERT + UPDATE)
- `trigger_decision` (UPDATE)
- `trigger_cancelled_approved` (UPDATE)
- `trigger_mark_approved_this_week` (BEFORE UPDATE)
- `trigger_mark_cancelled_this_week` (BEFORE UPDATE)

**Cron**
- pg_cron job `weekly-digest`, `0 11 * * 0`

**Edge Functions** (vivent hors base, dans Supabase Functions)
- `notify-new-booking`
- `notify-decision`
- `notify-cancelled-approved`
- `send-weekly-digest`

**Secrets référencés**
- `vault.decrypted_secrets` → `service_role_key` (utilisé par triggers + cron)
- Env Edge Functions : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_MODE`, `TEST_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

`[Certain]` Point 4 (Database Webhooks) : **"No hooks yet"**. Le relais passe donc par `net.http_post` codé en dur dans les fonctions PG, **pas** par les Supabase Webhooks. C'est un point de divergence avec la pratique Supabase courante.

`[Certain]` Point 7 (Auth > SMTP) : **"Enable Custom SMTP" désactivé.** L'auth Supabase (lien magique, confirmation d'inscription, reset password) tourne donc sur le **SMTP par défaut Supabase** — expéditeur générique `@mail.app.supabase.io`, limité à ~3-4 emails/heure, officiellement réservé au développement. C'est un **second canal email, distinct de Resend**, non géré et non versionné. Voir Q1 pour l'impact sur le périmètre #28.

---

## 5. Anomalies & dette repérées (constat, pas correctif)

1. `[Certain]` **Bug timezone, identique à #2/#3, présent dans les 4 fonctions.** Toutes utilisent `new Date(iso).toLocaleDateString(...)` (parse UTC) au lieu d'un `parseLocalDate`. Une date stockée `2026-02-15` peut s'afficher `14 février` dans un mail envoyé depuis un serveur en UTC. Touche les 4 canaux, donc **tous les emails de l'app**, pas seulement la page `demandes`.

2. `[Certain]` **3 fonctions relais sans `search_path` fixé** (`call_notify_*`). En SECURITY DEFINER, c'est un risque d'injection de search_path. Les fonctions de *marquage* le fixent, les fonctions de *relais* non — incohérence.

3. `[Certain]` **Couleurs de famille dupliquées et potentiellement divergentes.** `send-weekly-digest.ts` hardcode `familyColorFor()` (Antoine `#3b82f6`, François `#10b981`, Vincent `#f59e0b`) **en plus** de lire `families.color` depuis la base via la jointure. Deux sources de vérité pour la même couleur ; rien ne garantit qu'elles concordent. À rapprocher de `lib/families.ts` côté app (3e source).

4. `[Certain]` **`familyOrder` codé en dur** dans le digest : `['Antoine', 'François', 'Vincent']`. Ordre d'affichage figé dans la fonction, non dérivé de la base.

5. `[Probable]` **Le filtre "connectés uniquement" (`last_sign_in_at`) est silencieux.** Un membre jamais connecté ne reçoit JAMAIS d'email, sans trace ni alerte. Pour un nouvel arrivant dans la famille, c'est un trou : il faut qu'il se connecte une première fois pour entrer dans la boucle de notifications — mais rien ne le lui dit. Comportement voulu ou effet de bord non documenté ? → Q4.

6. `[Certain]` **Pas de gestion d'échec Resend au-delà du log.** Les 4 fonctions `console.error` et renvoient 500 si Resend échoue, mais **rien ne retente**. Un envoi raté est perdu définitivement. Le digest est le plus exposé : un échec = toute la semaine de récap perdue, et `changed_this_week` est quand même resetté juste après (à vérifier — l'ordre reset/échec n'est pas garanti). → Q5.

7. `[Hypothèse]` **`is_admin_created` comme commutateur d'email global.** Le bypass est répliqué dans 6 fonctions. Toute action admin = silence email total, par design. C'est cohérent, mais ça veut dire qu'un admin qui crée une résa pour quelqu'un ne déclenche aucune notification à personne — y compris au bénéficiaire. Voulu ?

---

## 6. Questions ouvertes à trancher pour la spec #28

> Ces questions ne présupposent **aucune** direction de refonte. Elles listent ce qu'il faut décider/obtenir avant d'écrire la cible.

**Q1 — SMTP : résolu (constat), décision de scope ouverte.** `[Certain]` "Enable Custom SMTP" est **désactivé** → l'auth tourne sur le SMTP par défaut Supabase, expéditeur `@mail.app.supabase.io`, ~3-4 mails/h, réservé au dev. C'est un canal email **distinct** des 4 canaux applicatifs (Resend). **Risque concret** : la première connexion d'un nouvel arrivant dépend d'un email d'auth qui passe par ce SMTP throttlé — or c'est précisément cette première connexion qui le fait entrer dans la boucle de notifications applicatives (filtre `last_sign_in_at`, cf. §5.5). Onboarder plusieurs membres le même soir (typiquement au lancement d'une saison) peut faire throttler les liens.
> **Décision à trancher pour #28 :** auth incluse ou non ?
> - **Inclure** (activer SMTP custom Resend pour l'auth, host `smtp.resend.com`, ~15 min, même domaine vérifié) → unifie l'expéditeur sur `@kerbrise.fr` **et** lève la limite de débit.
> - **Exclure** (auth reste sur le défaut Supabase) → ne touche pas à ce qui marche ; garde un fallback d'auth indépendant des Edge Functions (si Resend tombe, la connexion reste possible).
> `[Probable]` Vrai arbitrage cohérence vs fiabilité, les deux sont défendables. À décider explicitement, pas par défaut.

**Q2 — Périmètre de #28.** "Migration vers Resend" est un mauvais intitulé au vu du constat : **on est déjà sur Resend.** Que recouvre réellement #28 alors ? Hypothèses à confirmer :
- (a) Remplacer le relais `net.http_post`-codé-en-dur par des **Supabase Database Webhooks** (point 4 = "no hooks yet") ?
- (b) Sortir l'envoi des Edge Functions vers une lib partagée / templates centralisés ?
- (c) Juste versionner l'existant dans le repo sans changer le runtime ?
- (d) Autre chose ?
> `[Probable]` Tant que #28 n'est pas redéfini, le ticket décrit un problème qui n'existe plus.

**Q3 — Templates HTML dupliqués.** Les 4 fonctions répliquent le même squelette HTML (header `🏡 Kerbrise`, bouton CTA, footer `Mode test/Production`, `escapeHtml`). #28 doit-il extraire un template partagé ? Si oui, où vit-il — dans une Edge Function partagée, un package, ou une table de templates ? Décision d'architecture, pas évidente sur Deno/Edge.

**Q4 — Politique "connectés uniquement".** Le filtre `last_sign_in_at` est-il une règle métier voulue (on ne spamme pas les inactifs) ou un vestige ? #28 le conserve-t-il ? Si oui, faut-il un mécanisme pour onboarder les nouveaux (mail d'invitation hors de cette boucle) ?

**Q5 — Fiabilité d'envoi.** Faut-il introduire un retry / une file / un log d'envoi en base ? Aujourd'hui un échec Resend est silencieux et définitif. Question liée : faut-il une table `email_log` (qui résoudrait aussi l'angle mort d'observabilité — on ne sait pas *qui* a reçu *quoi*) ?

**Q6 — Bug timezone : in ou out du scope #28 ?** Le bug `new Date(iso)` touche les 4 fonctions. Soit #28 le corrige au passage (les fonctions sont déjà ouvertes), soit c'est un ticket séparé. À ne pas oublier dans les deux cas — sinon la refonte recopie le bug.

**Q7 — Centralisation des couleurs/ordre famille.** 3 sources de vérité pour les couleurs (`lib/families.ts`, `families.color` en DB, `familyColorFor` hardcodé dans le digest). #28 unifie-t-il, ou hors scope ?

---

## 7. Ce qui reste à vérifier (lacunes du constat)

- `[Hypothèse]` Ordre exact reset/échec dans `send-weekly-digest` : le `changed_this_week=false` est-il commit **avant** de savoir si Resend a réussi ? Le code montre le reset en fin de `try` ; à confirmer ligne par ligne sur la version déployée.
- `[Hypothèse]` Ventilation des 35 envois Edge par canal : impossible depuis les logs (user_agent identique). Nécessiterait soit un log applicatif, soit le détail Resend par `id` d'email.
- ~~Donnée manquante : config SMTP (Q1).~~ **Résolu** : SMTP custom désactivé, auth sur défaut Supabase (cf. §4, Q1). Reste la décision de scope, pas une lacune de donnée.
- `[Hypothèse]` Présence/absence d'autres jobs pg_cron : la sortie ne montre que jobid 1. Si `cron.job` n'a qu'une ligne, OK ; sinon il manque des lignes.
- `[Hypothèse]` Les Edge Functions auditées sont-elles bien les versions **déployées** (et pas une copie locale divergente) ? À recouper avec `supabase functions list` / dashboard.

