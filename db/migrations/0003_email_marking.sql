-- db/migrations/0003_email_marking.sql
--
-- Fonctions de MARQUAGE pour le digest hebdo + reset des votes au changement
-- de dates. Rapatriées telles quelles (audit 2026-06-13) : elles avaient DÉJÀ
-- `SET search_path TO 'public'`, rien à corriger ici.
--
-- ⚠️ Effet de bord documenté (spec #28 décision A) : is_admin_created = true
-- bypasse aussi ces fonctions de marquage. Donc "création admin silencieuse"
-- = pas d'email ET pas d'apparition dans le digest. Couplage accepté.

-- ── Marque une approbation pour le digest ──────────────────────────────────
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
$function$;

-- ── Marque une annulation pour le digest ───────────────────────────────────
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
$function$;

-- ── Reset des votes quand les dates changent ───────────────────────────────
-- Demi-ouvert : une réduction DANS l'ancienne période garde les votes ;
-- un débordement les invalide et repasse en pending.
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
$function$;

-- ── Triggers (idempotents) ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_mark_approved_this_week ON public.bookings;
CREATE TRIGGER trigger_mark_approved_this_week
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.mark_booking_approved_this_week();

DROP TRIGGER IF EXISTS trigger_mark_cancelled_this_week ON public.bookings;
CREATE TRIGGER trigger_mark_cancelled_this_week
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.mark_booking_cancelled_this_week();

DROP TRIGGER IF EXISTS before_booking_date_update ON public.bookings;
CREATE TRIGGER before_booking_date_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.reset_approvals_on_date_change();
