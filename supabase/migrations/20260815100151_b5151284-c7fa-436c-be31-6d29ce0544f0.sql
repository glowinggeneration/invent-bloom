-- Shared federation workspace: all signed-in users see the same operational data.

DROP POLICY IF EXISTS "Own x accounts readable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts insertable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts updatable" ON public.x_accounts;
DROP POLICY IF EXISTS "Own x accounts deletable" ON public.x_accounts;
CREATE POLICY "Shared workspace x accounts" ON public.x_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own brand profiles" ON public.brand_profiles;
CREATE POLICY "Shared workspace brand profiles" ON public.brand_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own listening campaigns" ON public.listening_campaigns;
CREATE POLICY "Shared workspace campaigns" ON public.listening_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own publish jobs" ON public.publish_jobs;
CREATE POLICY "Shared workspace publish jobs" ON public.publish_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
