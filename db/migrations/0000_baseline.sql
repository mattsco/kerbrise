-- 0000_baseline
-- =====================================================================
-- SNAPSHOT DE RÉFÉRENCE de la couche logique de la base Kerbrise,
-- capturé le 2026-06-25 depuis la prod (keufvhftoedgxclzecyp).
--
-- POURQUOI CE FICHIER
-- Avant lui, 16 fonctions, 11 triggers et 21 policies RLS ne vivaient QUE
-- dans le dashboard Supabase, hors de tout versionnement (§3.4 du review).
-- Une fonction perdue = logique métier irrécupérable. Ce dump les met sous
-- contrôle de version, pour relecture et récupération.
--
-- PÉRIMÈTRE
--   ✓ Extensions de base, tables (colonnes, PK/FK/CHECK, index), fonctions
--     (SECURITY DEFINER), triggers, policies RLS + activation RLS.
--   ⚠ Les CREATE TABLE EXCLUENT volontairement deux contraintes :
--       - approvals_unique_family_per_booking  → ajoutée par 0007
--       - bookings_no_overlap_approved (EXCLUDE) → ajoutée par 0008
--     Ainsi la séquence complète 0000 → 0010 se rejoue sans collision sur un
--     environnement vierge.
--   ✗ Le trigger de handle_new_user : il est posé sur auth.users (hors schéma
--     public, géré côté Supabase Auth), donc absent de ce dump. La FONCTION
--     handle_new_user est incluse, pas son trigger.
--
-- USAGE — IMPORTANT
--   • Env VIERGE (staging jetable, CI) : rejouer la séquence 0000 → 0010 dans
--     l'ordre. 0000 crée tables + logique, 0007/0008 ajoutent les contraintes.
--   • Prod EXISTANTE : NE PAS rejouer. Tout existe déjà ; les CREATE TABLE /
--     CREATE POLICY (sans IF NOT EXISTS) échoueraient. Ce fichier est une trace
--     de référence, pas une migration à appliquer sur la base actuelle.
--
-- DÉPENDANCES PLATEFORME présumées présentes (fournies par Supabase) :
--   vault (vault.decrypted_secrets), pg_net (net.http_post), pg_cron (cron.job),
--   btree_gist (contrainte EXCLUDE de 0008).
-- =====================================================================


-- ===================== EXTENSIONS =====================
-- btree_gist : requis par la contrainte EXCLUDE de 0008.
-- vault / pg_net / pg_cron : fournis et gérés par Supabase (non recréés ici).
create extension if not exists btree_gist;


-- ===================== TABLES (7) =====================
-- Ordre = dépendances de clés étrangères. Les 2 contraintes ajoutées par
-- 0007/0008 sont volontairement absentes (voir en-tête).

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz default now(),
  constraint families_name_key unique (name)
);

create table public.users (
  id uuid primary key,
  email text not null,
  display_name text,
  family_id uuid not null,
  created_at timestamptz default now(),
  is_family_head boolean default false,
  password_changed boolean default false,
  is_admin boolean default false,
  is_calendar_admin boolean default false,
  last_seen_at timestamptz,
  last_device text,
  last_os text,
  last_browser text,
  last_country text,
  last_city text,
  last_lat double precision,
  last_lng double precision,
  last_is_pwa boolean,
  constraint users_email_key unique (email),
  constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint users_family_id_fkey foreign key (family_id) references public.families(id)
);

create table public.family_members (
  email text primary key,
  family_id uuid not null,
  display_name text,
  created_at timestamptz default now(),
  is_family_head boolean default false,
  constraint family_members_family_id_fkey foreign key (family_id) references public.families(id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  created_by uuid not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_action_comment text,
  last_action_type text,
  previous_start_date date,
  previous_end_date date,
  changed_this_week boolean default false,
  is_admin_created boolean default false,
  constraint bookings_status_check check (status = any (array['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  constraint dates_valid check (end_date >= start_date),
  constraint duration_max check ((end_date - start_date) <= 60),
  constraint bookings_family_id_fkey foreign key (family_id) references public.families(id),
  constraint bookings_created_by_fkey foreign key (created_by) references public.users(id)
  -- bookings_no_overlap_approved (EXCLUDE) : ajouté par 0008.
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  family_id uuid not null,
  decision text not null,
  decided_by uuid not null,
  decided_at timestamptz default now(),
  comment text,
  constraint approvals_decision_check check (decision = any (array['approved'::text, 'rejected'::text])),
  constraint approvals_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete cascade,
  constraint approvals_family_id_fkey foreign key (family_id) references public.families(id),
  constraint approvals_decided_by_fkey foreign key (decided_by) references public.users(id)
  -- approvals_unique_family_per_booking (UNIQUE) : ajouté par 0007.
);

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_requests_title_check check (char_length(title) >= 3 and char_length(title) <= 100),
  constraint feature_requests_description_check check (char_length(description) >= 10 and char_length(description) <= 2000),
  constraint feature_requests_status_check check (status = any (array['pending'::text, 'in_progress'::text, 'done'::text, 'rejected'::text])),
  constraint feature_requests_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

create table public.webcam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  duration_seconds integer not null,
  started_at timestamptz default now(),
  constraint webcam_sessions_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

-- Index secondaires (hors PK / unique, créés par leurs contraintes).
create index bookings_changed_this_week_idx on public.bookings using btree (changed_this_week) where (changed_this_week = true);
create index bookings_dates_idx on public.bookings using btree (start_date, end_date);
create index bookings_status_idx on public.bookings using btree (status);
create index feature_requests_status_created_at_idx on public.feature_requests using btree (status, created_at desc);
create index webcam_sessions_started_idx on public.webcam_sessions using btree (started_at desc);
create index webcam_sessions_user_idx on public.webcam_sessions using btree (user_id);


-- ===================== FUNCTIONS (16) =====================

CREATE OR REPLACE FUNCTION public.call_notify_cancelled_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  -- Bypass si admin
  if new.is_admin_created = true then
    return new;
  end if;

  if new.status = 'cancelled' and old.status = 'approved' then
    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

    perform net.http_post(
      url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-cancelled-approved',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'record', row_to_json(new),
        'old_record', row_to_json(old)
      )
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.call_notify_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  -- Bypass si admin
  if new.is_admin_created = true then
    return new;
  end if;

  if old.status <> new.status
    and new.status in ('approved', 'rejected') then

    select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

    perform net.http_post(
      url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-decision',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'record', row_to_json(new),
        'old_record', row_to_json(old)
      )
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.call_notify_new_or_modified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  -- Bypass si création/modif par admin
  if new.is_admin_created = true then
    return new;
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  -- INSERT : nouvelle demande pending
  if TG_OP = 'INSERT' and new.status = 'pending' then
    perform net.http_post(
      url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-new-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
  -- UPDATE : modification des dates (la demande repasse en pending)
  elsif TG_OP = 'UPDATE'
    and new.status = 'pending'
    and old.status <> 'pending'
    and (old.start_date <> new.start_date or old.end_date <> new.end_date) then
    perform net.http_post(
      url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-new-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'record', row_to_json(new),
        'old_record', row_to_json(old)
      )
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.call_notify_reduced()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
  today_paris date := (now() at time zone 'Europe/Paris')::date;
begin
  -- Bypass admin
  if new.is_admin_created = true then
    return new;
  end if;

  -- Uniquement un séjour qui RESTE approuvé (le débordement repasse en pending
  -- via reset_approvals_on_date_change → ce n'est pas une libération).
  if new.status <> 'approved' or old.status <> 'approved' then
    return new;
  end if;

  -- Les dates doivent avoir changé.
  if old.start_date = new.start_date and old.end_date = new.end_date then
    return new;
  end if;

  -- Nouvelle période INCLUSE dans l'ancienne (réduction, pas déplacement/extension)
  -- ET au moins une borne a bougé vers l'intérieur.
  if not (new.start_date >= old.start_date and new.end_date <= old.end_date) then
    return new;
  end if;
  if not (new.start_date > old.start_date or new.end_date < old.end_date) then
    return new;
  end if;

  -- Borne 3 mois : on ne notifie en immédiat que les séjours proches.
  -- Au-delà → le digest s'en charge.
  if new.start_date > (today_paris + interval '3 months')::date then
    return new;
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  perform net.http_post(
    url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-reduced',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'record', row_to_json(new),
      'old_record', row_to_json(old)
    )
  );

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_booking_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Pas de check sur les cancelled
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Cherche un chevauchement réel (hors pivot du jour de départ)
  -- Avant: new.start_date <= b.end_date AND new.end_date >= b.start_date
  -- Maintenant: new.start_date < b.end_date AND new.end_date > b.start_date
  -- (le partage du jour-pivot est autorisé)
  if exists (
    select 1
    from bookings b
    where b.id <> new.id
      and b.status in ('pending', 'approved')
      and new.start_date < b.end_date
      and new.end_date > b.start_date
  ) then
    raise exception 'Chevauchement avec une réservation existante.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select family_id from users where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  member_record record;
begin
  select family_id, display_name, is_family_head into member_record
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
    );
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.health_cron_job(p_jobname text)
 RETURNS TABLE(active boolean, schedule text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
  select j.active, j.schedule
  from cron.job j
  where j.jobname = p_jobname;
$function$
;

CREATE OR REPLACE FUNCTION public.health_triggers()
 RETURNS TABLE(trigger_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.tgname::text
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal
    and c.relnamespace = 'public'::regnamespace;
$function$
;

CREATE OR REPLACE FUNCTION public.health_vault_secret(p_name text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select exists (select 1 from vault.secrets s where s.name = p_name);
$function$
;

CREATE OR REPLACE FUNCTION public.mark_booking_approved_this_week()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Bypass si admin
  if new.is_admin_created = true then
    return new;
  end if;

  if old.status = 'pending' and new.status = 'approved' then
    new.changed_this_week := true;
    new.last_action_type := 'approved';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_booking_cancelled_this_week()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Bypass si admin
  if new.is_admin_created = true then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'cancelled' then
    new.changed_this_week := true;
    new.last_action_type := 'cancelled';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_is_admin boolean;
begin
  -- Vérifier si l'appelant est admin
  select is_admin into caller_is_admin
  from users
  where id = auth.uid();

  -- Si admin, autoriser tout
  if caller_is_admin = true then
    return new;
  end if;

  -- Sinon, vérifier que les colonnes sensibles ne sont pas modifiées
  if new.is_admin is distinct from old.is_admin then
    raise exception 'Vous n''êtes pas autorisé à modifier is_admin';
  end if;

  if new.is_family_head is distinct from old.is_family_head then
    raise exception 'Vous n''êtes pas autorisé à modifier is_family_head';
  end if;

  if new.is_calendar_admin is distinct from old.is_calendar_admin then
    raise exception 'Vous n''êtes pas autorisé à modifier is_calendar_admin';
  end if;

  if new.family_id is distinct from old.family_id then
    raise exception 'Vous n''êtes pas autorisé à changer de famille';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Vous n''êtes pas autorisé à modifier votre email';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Vous ne pouvez pas changer votre id';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_approvals_on_date_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  approval_count int;
begin
  -- Pas de changement de dates → ne rien faire
  if old.start_date = new.start_date and old.end_date = new.end_date then
    return new;
  end if;

  -- Cas 1 : nouvelle période INCLUSE dans l'ancienne
  -- → Les votes existants restent valides (qu'on soit pending ou approved)
  if new.start_date >= old.start_date and new.end_date <= old.end_date then
    -- On NE TOUCHE PAS aux approvals
    -- On NE CHANGE PAS le statut (s'il était approved, il reste approved ;
    -- s'il était pending avec 1 vote, il reste pending avec 1 vote)

    -- On marque la modification pour le digest hebdo
    if not new.changed_this_week then
      new.previous_start_date := old.start_date;
      new.previous_end_date := old.end_date;
      new.changed_this_week := true;
    end if;
    new.last_action_type := 'reduced';
    return new;
  end if;

  -- Cas 2 : la nouvelle période DÉBORDE de l'ancienne
  -- → Les votes existants ne sont plus valides, on repart à zéro
  delete from approvals where booking_id = new.id;
  new.status := 'pending';
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_booking_status_after_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  booking_record record;
  approvals_count int;
  rejections_count int;
begin
  select * into booking_record from bookings where id = new.booking_id;
  if booking_record.status <> 'pending' then
    return new;
  end if;

  select
    count(distinct family_id) filter (where decision = 'approved'),
    count(distinct family_id) filter (where decision = 'rejected')
    into approvals_count, rejections_count
  from approvals
  where booking_id = new.booking_id;

  if rejections_count > 0 then
    update bookings set status = 'rejected' where id = new.booking_id;
  elsif approvals_count >= 2 then
    update bookings set status = 'approved' where id = new.booking_id;
  end if;

  return new;
end;
$function$
;


-- ===================== TRIGGERS (11) =====================
-- (handle_new_user vit sur auth.users, hors schéma public → non listé ici)

DROP TRIGGER IF EXISTS after_approval_insert ON public.approvals;
CREATE TRIGGER after_approval_insert AFTER INSERT ON public.approvals FOR EACH ROW EXECUTE FUNCTION update_booking_status_after_approval();

DROP TRIGGER IF EXISTS before_booking_date_update ON public.bookings;
CREATE TRIGGER before_booking_date_update BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION reset_approvals_on_date_change();

DROP TRIGGER IF EXISTS feature_requests_set_updated_at ON public.feature_requests;
CREATE TRIGGER feature_requests_set_updated_at BEFORE UPDATE ON public.feature_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_non_admin_sensitive_update_trigger ON public.users;
CREATE TRIGGER prevent_non_admin_sensitive_update_trigger BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION prevent_non_admin_sensitive_update();

DROP TRIGGER IF EXISTS trigger_cancelled_approved ON public.bookings;
CREATE TRIGGER trigger_cancelled_approved AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION call_notify_cancelled_approved();

DROP TRIGGER IF EXISTS trigger_check_overlap ON public.bookings;
CREATE TRIGGER trigger_check_overlap BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION check_booking_overlap();

DROP TRIGGER IF EXISTS trigger_decision ON public.bookings;
CREATE TRIGGER trigger_decision AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION call_notify_decision();

DROP TRIGGER IF EXISTS trigger_mark_approved_this_week ON public.bookings;
CREATE TRIGGER trigger_mark_approved_this_week BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION mark_booking_approved_this_week();

DROP TRIGGER IF EXISTS trigger_mark_cancelled_this_week ON public.bookings;
CREATE TRIGGER trigger_mark_cancelled_this_week BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION mark_booking_cancelled_this_week();

DROP TRIGGER IF EXISTS trigger_new_or_modified ON public.bookings;
CREATE TRIGGER trigger_new_or_modified AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION call_notify_new_or_modified();

DROP TRIGGER IF EXISTS trigger_notify_reduced ON public.bookings;
CREATE TRIGGER trigger_notify_reduced AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION call_notify_reduced();


-- ===================== RLS + POLICIES (21) =====================

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webcam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert any approval" ON public.approvals AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.is_admin = true)))));

CREATE POLICY "Admins can read webcam sessions" ON public.webcam_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY "Admins can update any profile" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.is_admin = true)))));

CREATE POLICY "Anyone can read families" ON public.families AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users read all bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users read all profiles" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users read approvals" ON public.approvals AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Calendar admins can delete any booking" ON public.bookings AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_calendar_admin = true)))));

CREATE POLICY "Calendar admins can insert any booking" ON public.bookings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_calendar_admin = true)))));

CREATE POLICY "Calendar admins can update any booking" ON public.bookings AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_calendar_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_calendar_admin = true)))));

CREATE POLICY "Family heads can insert approval" ON public.approvals AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((decided_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_family_head = true) AND (users.family_id = approvals.family_id)))) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = approvals.booking_id) AND (b.family_id <> approvals.family_id))))));

CREATE POLICY "Users can insert own webcam session" ON public.webcam_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own profile" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users delete own family bookings" ON public.bookings AS PERMISSIVE FOR DELETE TO authenticated
  USING ((family_id = get_my_family_id()));

CREATE POLICY "Users insert booking for their family" ON public.bookings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((family_id = get_my_family_id()) AND (created_by = auth.uid())));

CREATE POLICY "Users update own family bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((family_id = get_my_family_id()))
  WITH CHECK ((family_id = get_my_family_id()));

CREATE POLICY admins_delete_feature_requests ON public.feature_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY admins_select_all_feature_requests ON public.feature_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY admins_update_feature_requests ON public.feature_requests AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY users_insert_own_feature_request ON public.feature_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY users_select_own_feature_request ON public.feature_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
