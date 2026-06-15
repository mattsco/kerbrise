# `supabase/` + `db/migrations/` — infra email versionnée (#28, Session 1)

> **Statut** : Session 1 complète (rapatriement + fix timezone). Sessions 2-3 à venir.
> Spec : `docs/specs/email-migration.md` · Audit : `docs/architecture/EMAIL_AUDIT.md`

## Ce que contient cette session

- Les **4 Edge Functions** rapatriées sous Git (`supabase/functions/`).
- Un module partagé **`_shared/dates.ts`** : `parseLocalDate` timezone-correct →
  corrige le bug `new Date(iso)` des 4 fonctions (spec §4.1).
- Les **fonctions PG + triggers + cron** versionnées dans `db/migrations/`,
  avec `SET search_path TO 'public'` ajouté aux 3 relais (spec §4.5).

**Pas encore fait** (Sessions 2-3) : extraction de `_shared/{html,families,recipients}.ts`,
templates en fonctions pures, preview locale, suppression des 4 comptes inactifs
+ retrait du filtre `last_sign_in_at`, checkbox admin. `escapeHtml` et
`familyColorFor` restent donc dupliqués pour l'instant — c'est volontaire.

## ⚠️ Invariant : versionner ≠ déployer

Committer ici ne change rien en prod tant que le code n'a pas été déployé /
le SQL exécuté. Repo et prod peuvent diverger silencieusement.

## ⚠️ Dépendance `_shared` : redéployer TOUTES les fonctions

Les 4 fonctions importent `../_shared/dates.ts`. Le CLI bundle ce fichier au
déploiement (visible dans les logs : « Uploading asset … _shared/dates.ts »).
**Conséquence** : modifier `_shared/dates.ts` à l'avenir oblige à redéployer
**les 4 fonctions**, pas une seule.

## Déploiement des Edge Functions

```sh
supabase link --project-ref keufvhftoedgxclzecyp   # une fois par machine/session
supabase functions deploy notify-new-booking
supabase functions deploy notify-decision
supabase functions deploy notify-cancelled-approved
supabase functions deploy send-weekly-digest
```

## ⚠️ Migrations SQL : PAS `supabase db push` — passer par le dashboard

**Décision (2026-06-14).** Les migrations vivent dans **`db/migrations/`**
(convention de la spec #28 et du review §7, où ira aussi le futur
`0001_overlap_constraint.sql`). Le CLI Supabase, lui, ne lit QUE
`supabase/migrations/` avec un format `<timestamp>_nom.sql`.

Conséquence observée : `supabase db push` ignore `db/migrations/` et affiche
faussement **« Remote database is up to date »** — il n'a rien appliqué, mais
le message laisse croire que si. **Piège : ne jamais se fier à ce message pour
ces migrations.**

On **n'aligne PAS** le repo sur le format CLI : cela créerait une 2ᵉ convention
de nommage (`20260614…` vs `0002/0003/0004`) en contradiction avec la spec et le
review — exactement la pathologie « versions multiples » que l'audit email a
servi à éliminer. Une seule convention : `db/migrations/NNNN_nom.sql`.

### Comment appliquer (une fois, manuellement)

Dashboard → **SQL Editor** → coller et exécuter, **dans cet ordre** :

1. `db/migrations/0002_email_triggers.sql`
2. `db/migrations/0003_email_marking.sql`
3. `db/migrations/0004_weekly_digest_cron.sql`

Toutes idempotentes (`DROP TRIGGER IF EXISTS` avant `CREATE`,
`cron.unschedule` avant `cron.schedule`). Les appliquer = recréer les objets
existants à l'identique + ajouter le `search_path` manquant aux relais. Aucun
changement de comportement attendu.

> Si tu préfères la ligne de commande : `supabase db execute --file db/migrations/0002_email_triggers.sql`
> (puis 0003, 0004). C'est `db execute`, PAS `db push`.

## Critères de succès (non-régression)

Le fix timezone ne change PAS l'affichage si le runtime Edge est UTC ou Paris
(prouvé : formats identiques). Le vrai critère n'est donc pas « la date est
bonne » (elle l'était déjà) mais **« le HTML est identique à avant, à fuseau
égal »**. À vérifier en mode test (`EMAIL_TEST_MODE=true`, envoi vers TEST_EMAIL) :

1. Nouvelle demande pending → email `notify-new-booking` reçu, dates correctes.
2. Approbation → `notify-decision`, sujet `🎉 … : <jour mois> → …` intact
   (dépend du format long AVEC année : ne pas casser l'ordre).
3. Refus avec commentaire → `notify-decision`, bloc commentaire présent.
4. Annulation d'un approuvé → `notify-cancelled-approved`, sujet `🚫 …`.
5. Digest : déclenchable manuellement, dates SANS année préservées
   (« lundi 13 juillet », pas « lundi 13 juillet 2026 »).

## Secrets — NE JAMAIS committer

Fonctions : `RESEND_API_KEY`, `EMAIL_FROM`, `TEST_EMAIL`, `EMAIL_TEST_MODE`,
`SUPABASE_SERVICE_ROLE_KEY` (env Edge). Triggers/cron : `service_role_key`
depuis `vault.decrypted_secrets`. Aucune valeur en clair dans le repo.
