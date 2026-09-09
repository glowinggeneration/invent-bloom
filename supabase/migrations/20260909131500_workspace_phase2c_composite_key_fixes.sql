-- Phase 2c correction: four tables kept a natural key (or unique constraint)
-- that predates multi-tenancy - source_key, key, tweet_id, and (kind, value)
-- were each unique on their own before Phase 1 added workspace_id, and
-- neither Phase 1 nor Phase 2b widened them to include it. Unlike the
-- persona-catalog tables (see the previous migration), these genuinely are
-- per-workspace data - each workspace has its own ingestion pipeline health,
-- its own cached overview intel, its own collected mentions, its own
-- monitoring watchlist. Left as-is, a second workspace using the same
-- source_key/key/tweet_id/(kind,value) as an existing row - which is the
-- common case, not an edge case (every workspace uses the same fixed set of
-- apify source keys and the same "intel" cache key, and two workspaces
-- watching the same handle or keyword is entirely plausible) - would either
-- hit a hard constraint violation (monitoring_watchlist's plain insert) or
-- silently steal the row's workspace_id via upsert (apify_source_status,
-- overview_intel, x_mentions all upsert with the old single-column
-- onConflict target). Widening these to workspace-scoped composite keys
-- before a second workspace exists turns a live data-corruption bug into a
-- no-op schema change.

ALTER TABLE public.apify_source_status DROP CONSTRAINT apify_source_status_pkey;
ALTER TABLE public.apify_source_status ADD PRIMARY KEY (workspace_id, source_key);

ALTER TABLE public.overview_intel DROP CONSTRAINT overview_intel_pkey;
ALTER TABLE public.overview_intel ADD PRIMARY KEY (workspace_id, key);

ALTER TABLE public.x_mentions DROP CONSTRAINT x_mentions_pkey;
ALTER TABLE public.x_mentions ADD PRIMARY KEY (workspace_id, tweet_id);

ALTER TABLE public.monitoring_watchlist DROP CONSTRAINT monitoring_watchlist_kind_value_key;
ALTER TABLE public.monitoring_watchlist ADD CONSTRAINT monitoring_watchlist_workspace_kind_value_key
  UNIQUE (workspace_id, kind, value);

-- Same pattern, found by sweeping every onConflict target in the codebase
-- for ones that don't already carry workspace_id:

ALTER TABLE public.news_articles DROP CONSTRAINT news_articles_link_key;
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_workspace_link_key
  UNIQUE (workspace_id, link);

ALTER TABLE public.apify_mentions DROP CONSTRAINT apify_mentions_platform_external_id_key;
ALTER TABLE public.apify_mentions ADD CONSTRAINT apify_mentions_workspace_platform_external_id_key
  UNIQUE (workspace_id, platform, external_id);
DROP INDEX public.apify_mentions_url_key;
CREATE UNIQUE INDEX apify_mentions_url_key ON public.apify_mentions (workspace_id, url);

ALTER TABLE public.apify_profiles DROP CONSTRAINT apify_profiles_platform_handle_key;
ALTER TABLE public.apify_profiles ADD CONSTRAINT apify_profiles_workspace_platform_handle_key
  UNIQUE (workspace_id, platform, handle);

DROP INDEX public.reports_kind_period_idx;
CREATE UNIQUE INDEX reports_kind_period_idx
  ON public.reports (workspace_id, kind, report_date, period_start, period_end);
