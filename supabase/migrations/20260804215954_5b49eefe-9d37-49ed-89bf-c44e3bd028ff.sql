CREATE TABLE public.legal_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  surface TEXT NOT NULL,
  user_id UUID,
  persona_id TEXT,
  reference TEXT,
  original_text TEXT NOT NULL,
  revised_text TEXT NOT NULL DEFAULT '',
  risk_level SMALLINT NOT NULL DEFAULT 0,
  risk_categories TEXT[] NOT NULL DEFAULT '{}',
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  function_preserved BOOLEAN NOT NULL DEFAULT true,
  persona_preserved BOOLEAN NOT NULL DEFAULT true,
  facts_changed BOOLEAN NOT NULL DEFAULT false,
  approval_required TEXT NOT NULL DEFAULT 'none',
  confidence NUMERIC NOT NULL DEFAULT 0,
  escalation_note TEXT,
  auto_publish_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_reviews TO authenticated;
GRANT ALL ON public.legal_reviews TO service_role;

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read the legal audit trail"
ON public.legal_reviews FOR SELECT TO authenticated USING (true);

CREATE INDEX legal_reviews_created_at_idx ON public.legal_reviews (created_at DESC);
CREATE INDEX legal_reviews_risk_level_idx ON public.legal_reviews (risk_level DESC);