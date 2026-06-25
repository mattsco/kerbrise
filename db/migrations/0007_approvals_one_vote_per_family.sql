-- 0007_approvals_one_vote_per_family
-- Corrige la faille la plus grave : une famille pouvait voter "approved"
-- plusieurs fois sur la meme reservation et forcer l'approbation seule
-- (la regle metier exige 2 familles sur 3).
-- Deux verrous complementaires : contrainte unique (donnee) + count(distinct) (logique).
-- Applique en prod le 2026-06-25 via apply_migration (verifie OK).

alter table public.approvals
  add constraint approvals_unique_family_per_booking
  unique (booking_id, family_id);

create or replace function public.update_booking_status_after_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  booking_record record;
  approvals_count int;
  rejections_count int;
begin
  select * into booking_record from bookings where id = new.booking_id;
  if booking_record.status <> 'pending' then
    return new;
  end if;

  -- count(distinct family_id) au lieu de count(*) : blinde meme si la
  -- contrainte unique venait a etre retiree un jour.
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
$function$;
