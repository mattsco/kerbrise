-- db/migrations/0004_weekly_digest_cron.sql
--
-- Job pg_cron : appelle send-weekly-digest chaque dimanche 11h UTC.
-- Rapatrié depuis le dashboard (audit 2026-06-13, job "weekly-digest").
--
-- ⚠️ SECRET : service_role_key lue depuis vault.decrypted_secrets, jamais hardcodée.
-- ⚠️ Idempotence : on dé-programme l'ancien job avant de le recréer, sinon
--    cron.schedule créerait un doublon (→ 2 digests le même dimanche).

-- Dé-programme l'éventuel job existant (ignore l'erreur s'il n'existe pas)
do $$
begin
  perform cron.unschedule('weekly-digest');
exception when others then
  -- job inexistant : rien à faire
  null;
end $$;

select cron.schedule(
  'weekly-digest',
  '0 11 * * 0',
  $$
  select net.http_post(
    url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/send-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
