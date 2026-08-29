-- 0014_receives_house_alerts
-- =====================================================================
-- QUI REÇOIT LES RAPPELS PRATIQUES DE LA MAISON (#40).
--
-- Antoine : « envoyer un email à celui qui est en séjour, juste à François,
-- Vincent et Antoine, pas toute leur famille ».
--
-- ⚠️ POURQUOI PAS is_family_head — c'était le réflexe, c'est un piège.
-- En base, is_family_head est vrai pour CINQ personnes : Antoine, Claire,
-- François, Vincent, Nelly. Et surtout, ce drapeau ne veut pas dire
-- « représentant de la maison » mais « A LE DROIT DE VOTER sur les demandes
-- de séjour » (cf. policy RLS "Family heads can insert approval"). Le
-- réutiliser aurait lié deux sujets sans rapport : désabonner quelqu'un des
-- e-mails poubelle lui aurait retiré son droit de vote.
--
-- Défaut `false` : personne ne se retrouve abonné sans l'avoir demandé.
--
-- Nom volontairement large (`house_alerts`, pas `bin_reminders`) : si un jour
-- il faut prévenir d'une coupure d'eau, c'est le même public. Mais ça reste
-- UN BOOLÉEN — pas un centre de préférences de notification.
-- =====================================================================

alter table public.users
  add column if not exists receives_house_alerts boolean not null default false;

comment on column public.users.receives_house_alerts is
  'Reçoit les rappels pratiques de la maison (collecte recyclables, #40). Distinct de is_family_head, qui gouverne le droit de vote sur les séjours.';

-- Les trois référents désignés par Antoine. Ciblés par e-mail et non par
-- display_name : la colonne email est UNIQUE, un prénom ne l'est pas.
update public.users
   set receives_house_alerts = true
 where email in (
   'antoinescordia@gmail.com',   -- Antoine
   'scordia.vincent@yahoo.fr',   -- Vincent
   'francois.scordia@free.fr'    -- François
 );
