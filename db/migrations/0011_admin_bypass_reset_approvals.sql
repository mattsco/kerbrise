-- 0011_admin_bypass_reset_approvals
-- BUG : une modification de dates en mode admin calendrier faisait repasser le
-- séjour en 'pending' et supprimait les votes, alors qu'une action admin doit
-- être silencieuse et ne PAS toucher au statut.
--
-- CAUSE : reset_approvals_on_date_change (trigger BEFORE UPDATE sur bookings)
-- était la SEULE fonction trigger de bookings sans le garde-fou
-- `if new.is_admin_created then return new`. adminUpdateBooking() positionne
-- bien is_admin_created = true (ce qui bypasse les emails), mais ce trigger
-- l'ignorait : quand la nouvelle période débordait de l'ancienne (Cas 2), il
-- exécutait `delete from approvals` + `status := 'pending'`.
--
-- CORRECTIF : ajout du bypass admin en tête de fonction, à l'identique des
-- autres fonctions trigger (call_notify_*, mark_booking_*). Le reste de la
-- logique (Cas 1 réduction, Cas 2 débordement) est inchangé.
--
-- Appliqué en prod le 2026-06-28 via apply_migration.

CREATE OR REPLACE FUNCTION public.reset_approvals_on_date_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  approval_count int;
begin
  -- Bypass si modification par admin : ne touche ni au statut ni aux votes.
  if new.is_admin_created = true then
    return new;
  end if;

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
