-- Multi-tenant SaaS conversion, Phase 4 follow-up: real pricing shape for
-- plan_limits (20260909150000 seeded the tiers with placeholder limits and
-- no price at all).
--
-- Still no real billing - these are starting numbers the owner explicitly
-- expects to revise, not a Stripe integration. What changed is that the
-- three tiers are now priced to roughly track the actual marginal cost each
-- tier's usage caps imply across every paid API this platform depends on,
-- not picked arbitrarily:
--
--   - twitterapi.io: ~$0.15 / 1,000 tweets read, ~$0.18 / 1,000 profile
--     lookups (pay-per-call, scales with accounts + keywords monitored).
--   - Apify: prepaid compute-unit plans - Free ($0/$5 usage), Starter
--     ($29), Scale ($199), Business ($999) - burned down by the actor runs
--     behind the Apify sweep (Instagram/TikTok/YouTube/Threads/Facebook).
--   - IPRoyal: residential proxy bandwidth for account session management,
--     $1.75-7/GB depending on volume.
--   - NewsData.io: a platform-level fixed cost (Basic $199.99/mo, up to
--     Corporate $1299.99/mo) shared across every workspace today, not yet
--     workspace-metered - see the Exception Register row on the Apify/news
--     sweeps shipping unconfigured.
--   - Lovable AI gateway: token-metered, scales directly with the
--     max_ai_calls_month cap already in this table.
--   - Supabase: base infrastructure, not workspace-variable at this scale.
--
-- Free's few dollars of real cost is an accepted loss-leader. Pro's price
-- is set to roughly cover its own marginal cost with modest margin.
-- Enterprise is priced null ("contact us") rather than guessed - at 100
-- accounts / 250 keywords / 50k AI calls the real cost mix (which Apify
-- tier, how much proxy bandwidth, how much of the shared NewsData cost to
-- allocate) is genuinely too workspace-specific for one flat number to be
-- honest.

ALTER TABLE public.plan_limits ADD COLUMN monthly_price_usd numeric NULL;
ALTER TABLE public.plan_limits ADD COLUMN cost_note text NOT NULL DEFAULT '';

UPDATE public.plan_limits SET
  monthly_price_usd = 0,
  cost_note = 'Loss-leader tier. Real cost is a few dollars/month at this cap - a handful of thousand TwitterAPI.io reads, a small Lovable AI token budget, no dedicated Apify or proxy spend needed.'
WHERE tier = 'free';

UPDATE public.plan_limits SET
  monthly_price_usd = 79,
  cost_note = 'Priced to roughly cover its own marginal cost: ~$5-15/mo TwitterAPI.io reads, an Apify Starter-tier ($29) compute budget, ~$10-30/mo IPRoyal proxy bandwidth for account sessions, ~$10-30/mo Lovable AI tokens at the 5,000-call cap, plus a share of the shared NewsData.io and Supabase baseline costs.'
WHERE tier = 'pro';

UPDATE public.plan_limits SET
  monthly_price_usd = NULL,
  cost_note = 'Custom pricing, not a flat number - at this cap the real cost mix (Apify Scale vs. Business tier, proxy bandwidth, AI token volume, allocated share of NewsData.io) is genuinely workspace-specific.'
WHERE tier = 'enterprise';
