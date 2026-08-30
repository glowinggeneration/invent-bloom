ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'NewsData',
  ADD COLUMN IF NOT EXISTS title_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS news_articles_title_key_idx ON public.news_articles (title_key);
CREATE INDEX IF NOT EXISTS news_articles_provider_idx ON public.news_articles (provider);