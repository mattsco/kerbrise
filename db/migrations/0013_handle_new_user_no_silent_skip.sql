-- 0013_handle_new_user_no_silent_skip
-- =====================================================================
-- LE RATTACHEMENT D'UN COMPTE À UNE FAMILLE NE PEUT PLUS ÉCHOUER EN SILENCE.
--
-- PROBLÈME OBSERVÉ (audit du 25 août 2026, sur la base de production)
-- Quatre comptes existent dans auth.users sans ligne dans public.users :
--   lydwine.scordia@free.fr, scordeli@orange.fr,
--   benjamin.bonnin@gmail.com, benjamin.sauge@outlook.fr
-- Le dernier S'EST CONNECTÉ le 22 mai 2026, et n'est jamais revenu.
--
-- MÉCANISME
-- handle_new_user() était un `if found then insert ... end if` SANS branche
-- else. Si l'e-mail n'est pas dans family_members à la seconde où le compte
-- auth est créé, la fonction ne fait rien — et ne le dit à personne. Or
-- c'est précisément l'ordre suivi pendant la mise en place : les comptes ont
-- été créés le même jour que les lignes family_members, parfois avant.
--
-- Côté app, le compte s'authentifiait correctement puis se faisait renvoyer
-- au formulaire de connexion (`if (!profile) redirect("/login")`), sans
-- message : une boucle indistinguable d'un mauvais mot de passe.
--
-- CE QUE CETTE MIGRATION CHANGE — trois verrous indépendants
--   1. handle_new_user() gagne une branche else qui JOURNALISE. On garde un
--      `raise warning` et non un `raise exception` : faire échouer la
--      création du compte casserait le flux d'invitation quand l'admin crée
--      le compte AVANT d'ajouter la personne à family_members — c'est-à-dire
--      exactement ce qui s'est passé. On veut le voir, pas le bloquer.
--   2. Nouveau trigger de RATTRAPAGE sur family_members : ajouter quelqu'un
--      à la liste blanche crée son profil si son compte auth existe déjà.
--      C'est la moitié manquante — jusqu'ici le lien ne pouvait se faire que
--      dans un seul ordre.
--   3. backfill_orphan_profiles() : la même logique, appelable à la main
--      pour les comptes déjà orphelins. Volontairement NON exécutée ici (voir
--      la note en fin de fichier).
--
-- Côté application, requireProfile() sort désormais vers /compte-incomplet,
-- un écran qui explique. Les trois verrous sont complémentaires : celui-ci
-- empêche l'état d'apparaître, l'app le rend lisible s'il apparaît quand même.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. handle_new_user : ne plus ignorer un e-mail hors liste blanche
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  member_record record;
begin
  select family_id, display_name, is_family_head
    into member_record
    from family_members
    where email = new.email;

  if found then
    insert into users (id, email, display_name, family_id, is_family_head)
    values (
      new.id,
      new.email,
      coalesce(member_record.display_name, split_part(new.email, '@', 1)),
      member_record.family_id,
      coalesce(member_record.is_family_head, false)
    )
    on conflict (id) do nothing;
  else
    -- Visible dans les logs Postgres (Supabase → Logs → Postgres).
    -- Sans ça, l'absence de profil ne laissait AUCUNE trace nulle part.
    raise warning
      '[handle_new_user] compte auth % créé sans correspondance dans family_members (email=%) : aucun profil public.users. Ajouter l''e-mail à family_members déclenchera le rattrapage.',
      new.id, new.email;
  end if;

  return new;
end;
$function$;


-- ---------------------------------------------------------------------
-- 2. Rattrapage : ajouter à la liste blanche rattache un compte existant
-- ---------------------------------------------------------------------
-- Le lien family_members ↔ auth.users ne se faisait que dans un sens
-- (compte créé APRÈS la liste blanche). Ce trigger couvre l'autre sens.
create or replace function public.link_existing_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  auth_record record;
begin
  select id, email
    into auth_record
    from auth.users
    where email = new.email
    order by created_at
    limit 1;

  if not found then
    -- Cas normal : on ajoute la personne à la liste blanche avant qu'elle
    -- n'ait un compte. handle_new_user prendra le relais.
    return new;
  end if;

  insert into users (id, email, display_name, family_id, is_family_head)
  values (
    auth_record.id,
    auth_record.email,
    coalesce(new.display_name, split_part(auth_record.email, '@', 1)),
    new.family_id,
    coalesce(new.is_family_head, false)
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_family_member_added on public.family_members;
create trigger on_family_member_added
  after insert on public.family_members
  for each row
  execute function public.link_existing_auth_user();

-- Fonction TRIGGER : l'appeler via /rest/v1/rpc échoue de toute façon
-- ("trigger functions can only be called as triggers", vérifié sur cette
-- base). On révoque quand même — sans ça elle rejoignait les 9 autres
-- fonctions trigger déjà signalées par le linter Supabase, et une migration
-- de nettoyage n'a pas à allonger cette liste.
revoke execute on function public.link_existing_auth_user() from public;
revoke execute on function public.link_existing_auth_user() from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Rattrapage manuel des comptes DÉJÀ orphelins
-- ---------------------------------------------------------------------
-- Renvoie une ligne par profil créé, pour qu'un appel dise ce qu'il a fait.
create or replace function public.backfill_orphan_profiles()
returns table (created_id uuid, created_email text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  insert into users (id, email, display_name, family_id, is_family_head)
  select
    au.id,
    au.email,
    coalesce(fm.display_name, split_part(au.email, '@', 1)),
    fm.family_id,
    coalesce(fm.is_family_head, false)
  from auth.users au
  join family_members fm on fm.email = au.email
  left join users pu on pu.id = au.id
  where pu.id is null
  on conflict (id) do nothing
  returning users.id, users.email;
end;
$function$;

-- ⚠️ L'ORDRE ET LA CIBLE COMPTENT. Postgres accorde EXECUTE à PUBLIC par
-- défaut sur toute nouvelle fonction, et anon/authenticated en héritent.
-- Révoquer sur les deux rôles nommés SANS révoquer sur PUBLIC ne change
-- rien : vérifié sur cette base, la fonction restait appelable via
-- /rest/v1/rpc/backfill_orphan_profiles. C'est le même piège que les RPC
-- admin_* signalées par le linter Supabase.
revoke execute on function public.backfill_orphan_profiles() from public;
revoke execute on function public.backfill_orphan_profiles() from anon, authenticated;

-- ⚠️ VOLONTAIREMENT NON EXÉCUTÉ ICI.
--
-- `select * from public.backfill_orphan_profiles();` créerait les profils des
-- quatre comptes orphelins — mais donner accès à la maison n'est pas une
-- décision de migration. Deux des quatre sont des doublons d'adresse
-- (scordeli@orange.fr pour Elisabeth, qui utilise escordia@yahoo.fr depuis le
-- 28 juin) et deux ne portent pas de display_name, donc on ne sait même pas
-- avec certitude qui elles désignent.
--
-- Trancher d'abord qui doit avoir accès, purger les doublons de
-- family_members, PUIS lancer la fonction.
