-- db/migrations/0006_health_checks.sql
--
-- RPC de diagnostic pour la page /dashboard/admin/health.
--
-- Problème résolu : les checks cron / triggers / vault interrogeaient
-- directement les schémas internes (cron, information_schema, vault) via
-- PostgREST, qui n'expose que `public`. Ils tombaient donc toujours en `warn`
-- "non vérifiable" → bannière warnings allumée en permanence (alert fatigue).
--
-- Solution : 3 fonctions SECURITY DEFINER dans `public` (donc appelables via
-- PostgREST .rpc()) qui lisent les schémas internes côté serveur et renvoient
-- un résultat vérifiable. Tant que cette migration n'est pas appliquée, les
-- checks s'affichent en `skip` (neutre), pas en `warn`.
--
-- ⚠️ Sensibilité : ces fonctions ne renvoient QUE des métadonnées d'existence
--    et de statut — jamais la valeur d'un secret. Accès limité à `authenticated`
--    (la page elle-même est déjà gated is_admin).

-- 1. Statut d'un job pg_cron (nom, planning, actif)
create or replace function public.health_cron_job(p_jobname text)
returns table (active boolean, schedule text)
language sql
security definer
set search_path = public, cron
as $$
  select j.active, j.schedule
  from cron.job j
  where j.jobname = p_jobname;
$$;

-- 2. Liste des triggers non-internes du schéma public
create or replace function public.health_triggers()
returns table (trigger_name text)
language sql
security definer
set search_path = public
as $$
  select t.tgname::text
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal
    and c.relnamespace = 'public'::regnamespace;
$$;

-- 3. Présence d'un secret nommé dans le vault (booléen, sans révéler la valeur)
create or replace function public.health_vault_secret(p_name text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (select 1 from vault.secrets s where s.name = p_name);
$$;

-- Exposition : uniquement aux utilisateurs authentifiés, pas à anon.
revoke all on function public.health_cron_job(text) from public, anon;
revoke all on function public.health_triggers() from public, anon;
revoke all on function public.health_vault_secret(text) from public, anon;

grant execute on function public.health_cron_job(text) to authenticated;
grant execute on function public.health_triggers() to authenticated;
grant execute on function public.health_vault_secret(text) to authenticated;
