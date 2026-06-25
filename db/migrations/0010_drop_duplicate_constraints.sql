-- 0010_drop_duplicate_constraints
-- Nettoyage : la prod portait DEUX contraintes identiques sur chaque table,
-- l'une trackee par une migration, l'autre orpheline (creee hors repo avant
-- versionnement). Aucun impact fonctionnel (les paires sont strictement
-- identiques) mais c'est du bruit et une source de confusion.
--
-- On garde la contrainte NOMMEE par les migrations versionnees, on drop l'autre :
--   approvals : garde approvals_unique_family_per_booking (0007)
--               drop  approvals_booking_id_family_id_key   (orpheline)
--   bookings  : garde bookings_no_overlap_approved         (0008)
--               drop  bookings_no_overlap_when_approved     (preexistante)
--
-- Apres cette migration, l'etat prod correspond exactement a ce que declarent
-- les migrations versionnees.
-- Applique en prod le 2026-06-25 via apply_migration.

alter table public.approvals
  drop constraint if exists approvals_booking_id_family_id_key;

alter table public.bookings
  drop constraint if exists bookings_no_overlap_when_approved;
