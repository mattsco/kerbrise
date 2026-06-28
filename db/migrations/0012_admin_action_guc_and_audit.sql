-- 0012_admin_action_guc_and_audit
-- =====================================================================
-- REFONTE DU MODE ADMIN CALENDRIER.
--
-- PROBLÈME (suite de 0011) : la colonne bookings.is_admin_created portait DEUX
-- rôles incompatibles :
--   1. PROVENANCE persistante  → utilisée par les analytics pour distinguer les
--      créations admin des vraies demandes des membres.
--   2. BYPASS des triggers      → lue par 7 fonctions trigger pour ne pas
--      envoyer d'email / ne pas toucher au statut.
-- Comme la colonne est PERSISTANTE et qu'aucune écriture ne la remet à false,
-- un séjour touché une fois en admin restait "tainté" : toute édition membre
-- ultérieure bypassait silencieusement emails ET reset des votes.
--
-- CORRECTIF : on sépare les deux rôles.
--   • is_admin_created : redevient un marqueur de PROVENANCE pur, posé à la
--     création seulement, plus jamais lu par aucun trigger.
--   • Le bypass devient un SIGNAL DE TRANSACTION via des GUC de session
--     (app.admin_action / app.admin_notify), positionnés en is_local par les
--     RPC admin ci-dessous. Impossible de "fuiter" d'une écriture à l'autre :
--     le signal meurt avec la transaction.
--
-- NOUVELLES CAPACITÉS MODE ADMIN (RPC ci-dessous) :
--   • Choix d'envoyer ou non les emails (toggle), indépendant du bypass statut.
--   • Modification manuelle du statut.
--   • Réassignation famille / créateur.
--   • Journal d'audit (table admin_audit) : qui / quand / quoi / avant-après.
--
-- SÉMANTIQUE :
--   - En mode admin, les triggers de STATUT (reset votes, marquage semaine)
--     sont TOUJOURS bypassés : l'admin pilote le statut à la main.
--   - Les emails ne partent en mode admin QUE si app.admin_notify = 'on'.
--   - Hors admin (GUC absents) : comportement strictement inchangé.
--
-- Appliqué en prod le 2026-06-28 via apply_migration.
-- =====================================================================


-- ── Helpers de lecture des signaux de transaction ──────────────────────────
-- current_setting(name, true) → NULL si non défini (missing_ok), donc false
-- pour toute écriture qui ne passe pas par un RPC admin (= comportement normal).
CREATE OR REPLACE FUNCTION public.is_admin_action()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(current_setting('app.admin_action', true), '') = 'on';
$function$;

CREATE OR REPLACE FUNCTION public.admin_wants_email()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(current_setting('app.admin_notify', true), '') = 'on';
$function$;


-- ── Triggers EMAIL : bypass si action admin SANS notification demandée ──────
-- (avant : bypass si new.is_admin_created = true)

CREATE OR REPLACE FUNCTION public.call_notify_new_or_modified()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  if public.is_admin_action() and not public.admin_wants_email() then
    return new;
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if TG_OP = 'INSERT' and new.status = 'pending' then
    perform net.http_post(
      url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/notify-new-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
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
$function$;

CREATE OR REPLACE FUNCTION public.call_notify_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  if public.is_admin_action() and not public.admin_wants_email() then
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
$function$;

CREATE OR REPLACE FUNCTION public.call_notify_cancelled_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  service_key text;
begin
  if public.is_admin_action() and not public.admin_wants_email() then
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
$function$;

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
  if public.is_admin_action() and not public.admin_wants_email() then
    return new;
  end if;

  if new.status <> 'approved' or old.status <> 'approved' then
    return new;
  end if;

  if old.start_date = new.start_date and old.end_date = new.end_date then
    return new;
  end if;

  if not (new.start_date >= old.start_date and new.end_date <= old.end_date) then
    return new;
  end if;
  if not (new.start_date > old.start_date or new.end_date < old.end_date) then
    return new;
  end if;

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
$function$;


-- ── Triggers STATUT : toujours bypassés en mode admin ──────────────────────
-- L'admin pilote le statut à la main, donc on ne reset pas les votes et on ne
-- marque pas la semaine automatiquement.

CREATE OR REPLACE FUNCTION public.reset_approvals_on_date_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  approval_count int;
begin
  if public.is_admin_action() then
    return new;
  end if;

  if old.start_date = new.start_date and old.end_date = new.end_date then
    return new;
  end if;

  if new.start_date >= old.start_date and new.end_date <= old.end_date then
    if not new.changed_this_week then
      new.previous_start_date := old.start_date;
      new.previous_end_date := old.end_date;
      new.changed_this_week := true;
    end if;
    new.last_action_type := 'reduced';
    return new;
  end if;

  delete from approvals where booking_id = new.id;
  new.status := 'pending';
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_booking_approved_this_week()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_admin_action() then
    return new;
  end if;

  if old.status = 'pending' and new.status = 'approved' then
    new.changed_this_week := true;
    new.last_action_type := 'approved';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_booking_cancelled_this_week()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_admin_action() then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'cancelled' then
    new.changed_this_week := true;
    new.last_action_type := 'cancelled';
  end if;
  return new;
end;
$function$;


-- ── Journal d'audit admin ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  booking_id uuid,
  family_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  notified boolean default false,
  created_at timestamptz not null default now(),
  constraint admin_audit_action_check
    check (action = any (array['create'::text, 'update'::text, 'cancel'::text, 'delete'::text]))
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx
  ON public.admin_audit using btree (created_at desc);

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux admins. Aucune policy INSERT : les écritures passent
-- exclusivement par les RPC SECURITY DEFINER ci-dessous (qui bypassent RLS).
DROP POLICY IF EXISTS "Admins read audit" ON public.admin_audit;
CREATE POLICY "Admins read audit" ON public.admin_audit AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


-- ── RPC admin : signalent la transaction + écrivent + auditent ─────────────
-- Toutes SECURITY DEFINER (bypass RLS) → re-vérifient l'autorisation à la main.

CREATE OR REPLACE FUNCTION public.admin_create_booking(
  p_start date,
  p_end date,
  p_family_id uuid,
  p_created_by uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notify boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_after jsonb;
begin
  if not exists (select 1 from users where id = auth.uid() and is_calendar_admin = true) then
    raise exception 'Non autorisé : admin calendrier requis.';
  end if;

  perform set_config('app.admin_action', 'on', true);
  perform set_config('app.admin_notify', case when p_notify then 'on' else 'off' end, true);

  insert into bookings (family_id, created_by, start_date, end_date, status, note, is_admin_created)
  values (p_family_id, p_created_by, p_start, p_end,
          case when p_status = 'approved' then 'approved' else 'pending' end,
          p_note, true)
  returning id into v_id;

  select to_jsonb(b) into v_after from bookings b where id = v_id;

  insert into admin_audit (actor_id, action, booking_id, family_id, before, after, reason, notified)
  values (auth.uid(), 'create', v_id, p_family_id, null, v_after, p_reason, p_notify);

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_booking(
  p_id uuid,
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_family_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notify boolean DEFAULT false
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not exists (select 1 from users where id = auth.uid() and is_calendar_admin = true) then
    raise exception 'Non autorisé : admin calendrier requis.';
  end if;

  select to_jsonb(b) into v_before from bookings b where id = p_id;
  if v_before is null then
    raise exception 'Réservation introuvable.';
  end if;

  perform set_config('app.admin_action', 'on', true);
  perform set_config('app.admin_notify', case when p_notify then 'on' else 'off' end, true);

  update bookings set
    start_date          = coalesce(p_start, start_date),
    end_date            = coalesce(p_end, end_date),
    status              = coalesce(p_status, status),
    family_id           = coalesce(p_family_id, family_id),
    created_by          = coalesce(p_created_by, created_by),
    last_action_comment = coalesce(p_reason, last_action_comment)
  where id = p_id;

  select to_jsonb(b) into v_after from bookings b where id = p_id;

  insert into admin_audit (actor_id, action, booking_id, family_id, before, after, reason, notified)
  values (auth.uid(), 'update', p_id, (v_after->>'family_id')::uuid, v_before, v_after, p_reason, p_notify);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(
  p_id uuid,
  p_reason text DEFAULT NULL,
  p_notify boolean DEFAULT false
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not exists (select 1 from users where id = auth.uid() and is_calendar_admin = true) then
    raise exception 'Non autorisé : admin calendrier requis.';
  end if;

  select to_jsonb(b) into v_before from bookings b where id = p_id;
  if v_before is null then
    raise exception 'Réservation introuvable.';
  end if;

  perform set_config('app.admin_action', 'on', true);
  perform set_config('app.admin_notify', case when p_notify then 'on' else 'off' end, true);

  update bookings set
    status              = 'cancelled',
    last_action_type    = 'cancelled',
    last_action_comment = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_id;

  select to_jsonb(b) into v_after from bookings b where id = p_id;

  insert into admin_audit (actor_id, action, booking_id, family_id, before, after, reason, notified)
  values (auth.uid(), 'cancel', p_id, (v_after->>'family_id')::uuid, v_before, v_after, p_reason, p_notify);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_booking(
  p_id uuid,
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_before jsonb;
begin
  if not exists (select 1 from users where id = auth.uid() and is_calendar_admin = true) then
    raise exception 'Non autorisé : admin calendrier requis.';
  end if;

  select to_jsonb(b) into v_before from bookings b where id = p_id;
  if v_before is null then
    raise exception 'Réservation introuvable.';
  end if;

  -- Suppression = jamais d'email. On signale quand même l'action admin.
  perform set_config('app.admin_action', 'on', true);
  perform set_config('app.admin_notify', 'off', true);

  delete from approvals where booking_id = p_id;
  delete from bookings where id = p_id;

  insert into admin_audit (actor_id, action, booking_id, family_id, before, after, reason, notified)
  values (auth.uid(), 'delete', p_id, (v_before->>'family_id')::uuid, v_before, null, p_reason, false);
end;
$function$;
