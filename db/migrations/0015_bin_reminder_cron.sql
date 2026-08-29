-- 0015_bin_reminder_cron
-- =====================================================================
-- CRON DU RAPPEL « BAC JAUNE » (#40).
--
-- ⚠️ NE PAS APPLIQUER AVANT d'avoir fait les trois choses ci-dessous, sinon
-- le job tapera dans le vide chaque mardi (401 ou 404) :
--
--   1. Déployer l'app (la route /api/cron/rappel-poubelle doit exister).
--   2. Poser sur Vercel : CRON_SECRET, RESEND_API_KEY, EMAIL_FROM
--      (+ EMAIL_TEST_MODE / TEST_EMAIL pour la recette).
--   3. Poser LA MÊME valeur de CRON_SECRET dans le vault Supabase :
--        select vault.create_secret('<valeur>', 'cron_secret');
--
-- POURQUOI DEUX HEURES (16h ET 17h UTC)
-- Antoine a demandé 18h. pg_cron parle UTC, or 18h à Paris vaut 16h UTC
-- l'été et 17h UTC l'hiver. Plutôt que d'accepter une dérive d'une heure
-- (ce que fait le digest hebdo, à 11h UTC), on déclenche AUX DEUX heures et
-- c'est la route qui laisse passer celle qui vaut réellement 18h à Paris
-- (garde `parisHour`, verrouillé par test). Exactement un des deux passages
-- envoie, toute l'année, changement d'heure compris.
--
-- La cadence « un mercredi sur deux » n'est PAS dans l'expression cron : le
-- job tourne tous les mardis et c'est la route qui interroge
-- `lib/garbage-collection.ts`. Mettre la quinzaine ici recréerait le
-- calendrier des collectes à un troisième endroit (cf. spec §D1).
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
    url := 'https://kerbrise.fr/api/cron/rappel-poubelle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
