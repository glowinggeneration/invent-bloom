CREATE TABLE public.mention_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz
);

CREATE UNIQUE INDEX mention_keywords_term_key ON public.mention_keywords (lower(term));

GRANT SELECT ON public.mention_keywords TO authenticated;
GRANT ALL ON public.mention_keywords TO service_role;

ALTER TABLE public.mention_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read listening keywords"
ON public.mention_keywords FOR SELECT TO authenticated USING (true);

INSERT INTO public.mention_keywords (term, source) VALUES
  ('Football Kenya Federation', 'seed'),
  ('FKF', 'seed'),
  ('Harambee Stars', 'seed'),
  ('Harambee Starlets', 'seed'),
  ('FKF Premier League', 'seed'),
  ('Kenyan football', 'seed'),
  ('Hussein Mohammed FKF', 'seed'),
  ('FKF president', 'seed'),
  ('Kenya national team football', 'seed'),
  ('FKF elections', 'seed');