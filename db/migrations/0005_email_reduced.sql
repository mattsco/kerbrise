-- db/migrations/0005_email_reduced.sql
--
-- Nouveau canal : email immédiat quand un séjour APPROUVÉ est RACCOURCI
-- (nouvelle période incluse dans l'ancienne) et que le séjour commence
-- dans les 3 prochains mois. Au-delà de 3 mois → pas d'email immédiat,
-- la réduction est récapitulée par le digest hebdo (déjà le cas :
-- last_action_type='reduced' est posé par reset_approvals_on_date_change).
--
-- ⚠️ Borne 3 mois calculée ICI (SQL), pas dans l'Edge Function : un séjour
-- lointain ne déclenche AUCUN appel HTTP (pas d'email fantôme).
--
-- ⚠️ AFTER UPDATE : le marquage 'reduced' est posé par un trigger BEFORE
-- (before_booking_date_update). On lit donc la ligne déjà marquée.
--
-- Couplage assumé (décision produit) : une réduction proche déclenche cet
-- email immédiat ET réapparaît dans le digest du dimanche. Cohérent avec
-- l'annulation d'un approuvé.

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
$function$;

DROP TRIGGER IF EXISTS trigger_notify_reduced ON public.bookings;
CREATE TRIGGER trigger_notify_reduced
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.call_notify_reduced();
