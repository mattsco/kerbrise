-- 0009_feature_requests_admin_with_check
-- Defaut mineur : la policy UPDATE admin avait un USING mais pas de WITH CHECK.
-- Un admin pouvait donc reassigner user_id vers quelqu'un d'autre en update.
-- Applique en prod le 2026-06-25 (verifie OK).

drop policy "admins_update_feature_requests" on public.feature_requests;
create policy "admins_update_feature_requests"
  on public.feature_requests for update
  using (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true))
  with check (exists (select 1 from users where users.id = auth.uid() and users.is_admin = true));
