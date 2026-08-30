CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pub_date TIMESTAMP WITH TIME ZONE,
  source_id TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category TEXT[] NOT NULL DEFAULT '{}',
  matched_query TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_pub_date_idx ON public.news_articles (pub_date DESC NULLS LAST);

GRANT SELECT ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read news"
ON public.news_articles FOR SELECT TO authenticated USING (true);