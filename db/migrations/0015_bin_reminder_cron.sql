-- 0015_bin_reminder_cron
-- =====================================================================
-- CRON DU RAPPEL « POUBELLE BLEUE » (#40).
--
-- Décalque de 0004_weekly_digest_cron.sql : même vault, même clé, même
-- forme. AUCUN NOUVEAU SECRET À POSER — c'est tout l'intérêt d'avoir remis
-- l'envoi dans une Edge Function plutôt que dans une route Vercel :
--   • l'authentification réutilise `service_role_key`, déjà dans le vault
--     depuis le 20 mai (« Clé pour appeler les Edge Functions depuis les
--     triggers ») ;
--   • RESEND_API_KEY / EMAIL_FROM / EMAIL_TEST_MODE / TEST_EMAIL sont déjà
--     des secrets du projet, hérités par toutes les fonctions.
--
-- POURQUOI DEUX HEURES (16h ET 17h UTC)
-- Antoine a demandé 18h. pg_cron parle UTC, or 18h à Paris vaut 16h UTC
-- l'été et 17h UTC l'hiver. Plutôt que d'accepter une dérive d'une heure
-- (ce que fait le digest hebdo, à 11h UTC), on déclenche AUX DEUX heures et
-- c'est la fonction qui laisse passer celle qui vaut réellement 18h à Paris
-- (garde `parisHour`, verrouillé par test). Exactement un des deux passages
-- envoie, toute l'année, changement d'heure compris.
--
-- La cadence « un mercredi sur deux » n'est PAS dans l'expression cron : le
-- job tourne tous les mardis et c'est la fonction qui interroge
-- `_shared/garbage-collection.ts`. Mettre la quinzaine ici recréerait le
-- calendrier des collectes à un deuxième endroit — et celui-là expire le
-- 31/01/2027 (cf. spec §7 et check santé #33).
--
-- ⚠️ Déployer la fonction AVANT d'appliquer cette migration :
--     supabase functions deploy send-bin-reminder
-- =====================================================================

do $$
begin
  perform cron.unschedule('bin-reminder');
exception when others then
  null;  -- job inexistant : rien à faire
end $$;

select cron.schedule(
  'bin-reminder',
  '0 16,17 * * 2',
  $$
  select net.http_post(
    url := 'https://keufvhftoedgxclzecyp.supabase.co/functions/v1/send-bin-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
