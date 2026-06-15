-- db/migrations/0002_email_triggers.sql
--
-- Fonctions de RELAIS des emails : trigger PG → net.http_post → Edge Function.
-- Rapatriées depuis le dashboard Supabase (audit 2026-06-13).
--
-- ⚠️ CORRECTIF SÉCURITÉ (spec #28 §4.5) : les 3 fonctions de relais étaient
-- SECURITY DEFINER SANS search_path fixé → risque d'injection de search_path.
-- On ajoute `SET search_path TO 'public'` aux 3 (les fonctions de marquage
-- l'avaient déjà, voir 0003).
--
-- ⚠️ SECRET : la service_role_key est lue depuis vault.decrypted_secrets.
-- Aucune valeur de clé n'apparaît dans ce fichier. Ne JAMAIS hardcoder.
--
-- Les triggers eux-mêmes (trigger_new_or_modified, trigger_decision,
-- trigger_cancelled_approved) sont (re)créés en fin de fichier.

-- ── Canal 1 : nouvelle demande / demande modifiée ──────────────────────────
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
$function$;

-- ── Canal 2 : décision (approbation / refus) ───────────────────────────────
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
$function$;

-- ── Canal 3 : annulation d'une réservation confirmée ───────────────────────
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
$function$;

-- ── Triggers (idempotents) ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_new_or_modified ON public.bookings;
CREATE TRIGGER trigger_new_or_modified
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.call_notify_new_or_modified();

DROP TRIGGER IF EXISTS trigger_decision ON public.bookings;
CREATE TRIGGER trigger_decision
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.call_notify_decision();

DROP TRIGGER IF EXISTS trigger_cancelled_approved ON public.bookings;
CREATE TRIGGER trigger_cancelled_approved
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.call_notify_cancelled_approved();
