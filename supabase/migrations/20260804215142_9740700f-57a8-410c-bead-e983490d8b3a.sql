CREATE TABLE public.persona_state (
  persona_id text PRIMARY KEY,
  adaptive jsonb NOT NULL DEFAULT '{}'::jsonb,
  learning_rate numeric NOT NULL DEFAULT 0.10,
  persona_version integer NOT NULL DEFAULT 1,
  drift_score numeric NOT NULL DEFAULT 0,
  frozen boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.persona_state TO authenticated;
GRANT ALL ON public.persona_state TO service_role;
ALTER TABLE public.persona_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read persona state"
  ON public.persona_state FOR SELECT TO authenticated USING (true);

CREATE TRIGGER persona_state_updated_at BEFORE UPDATE ON public.persona_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.persona_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  weight numeric NOT NULL,
  field text NOT NULL,
  delta numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persona_learning_events_persona_idx ON public.persona_learning_events (persona_id, created_at DESC);

GRANT SELECT ON public.persona_learning_events TO authenticated;
GRANT ALL ON public.persona_learning_events TO service_role;
ALTER TABLE public.persona_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read learning events"
  ON public.persona_learning_events FOR SELECT TO authenticated USING (true);