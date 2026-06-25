-- 0008_bookings_exclude_overlap_approved
-- Corrige la condition de course : le trigger check_booking_overlap fait
-- SELECT-puis-INSERT sans verrou, donc deux insertions concurrentes passent.
-- Une contrainte EXCLUDE gist pose un verrou physique sur la plage et
-- serialise reellement les insertions.
--
-- Perimetre : status = 'approved' UNIQUEMENT. Ne PAS etendre a 'pending' :
-- plusieurs familles doivent pouvoir demander la meme semaine d'ete (on
-- departage ensuite par rotation/approbation). Le trigger procedural reste
-- en place pour la garde souple sur pending.
--
-- Semantique pivot : daterange '[)' (borne haute exclue) -> une famille peut
-- partir le jour ou une autre arrive. Coherent avec le trigger existant.
--
-- Prerequis : extension btree_gist (deja installee, v1.7).
-- Applique en prod le 2026-06-25 (verifie OK, aucun chevauchement preexistant).

alter table public.bookings
  add constraint bookings_no_overlap_approved
  exclude using gist (
    daterange(start_date, end_date, '[)') with &&
  ) where (status = 'approved');
