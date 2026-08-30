DROP POLICY IF EXISTS "Users manage their own campaign replies" ON public.campaign_replies;
CREATE POLICY "Shared workspace campaign replies" ON public.campaign_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own publish actions" ON public.publish_actions;
CREATE POLICY "Shared workspace publish actions" ON public.publish_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their scheduled actions" ON public.scheduled_actions;
CREATE POLICY "Shared workspace scheduled actions" ON public.scheduled_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their persona plans" ON public.persona_daily_plans;
CREATE POLICY "Shared workspace persona plans" ON public.persona_daily_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners manage their persona posts" ON public.persona_daily_posts;
CREATE POLICY "Shared workspace persona posts" ON public.persona_daily_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Own tweet metrics" ON public.tweet_metrics;
CREATE POLICY "Shared workspace tweet metrics" ON public.tweet_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users read their own skip audit" ON public.campaign_skip_audit;
CREATE POLICY "Shared workspace skip audit readable" ON public.campaign_skip_audit FOR SELECT TO authenticated USING (true);
