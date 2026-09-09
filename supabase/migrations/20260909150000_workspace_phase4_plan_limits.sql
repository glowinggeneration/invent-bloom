-- Multi-tenant SaaS conversion, Phase 4: plan-tier data shape.
--
-- No real billing yet (confirmed scope decision: build the shape, fake the
-- plans). plan_limits is reference data - tier -> numeric caps - joined
-- against workspaces.plan_tier (already exists, default 'free' since
-- Phase 1) to show usage vs. limit in the UI. Enforced softly: the app
-- surfaces usage against these numbers, it never blocks an action past a
-- cap, since with no real payment flow yet a hard block would trap someone
-- with no way to actually upgrade. Upgrade/downgrade is a plain admin-set
-- UPDATE workspaces SET plan_tier, done from the SaaS-owner dashboard.

CREATE TABLE public.plan_limits (
  tier text PRIMARY KEY,
  label text NOT NULL,
  max_accounts integer NOT NULL,
  max_seats integer NOT NULL,
  max_keywords integer NOT NULL,
  max_ai_calls_month integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.plan_limits (tier, label, max_accounts, max_seats, max_keywords, max_ai_calls_month, sort_order)
VALUES
  ('free', 'Free', 2, 1, 10, 500, 0),
  ('pro', 'Pro', 10, 5, 50, 5000, 1),
  ('enterprise', 'Enterprise', 100, 25, 250, 50000, 2);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;
CREATE POLICY "Plan limits readable by signed-in users" ON public.plan_limits
FOR SELECT TO authenticated USING (true);
