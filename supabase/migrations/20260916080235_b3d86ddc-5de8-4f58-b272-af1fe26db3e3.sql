CREATE TABLE IF NOT EXISTS public.channel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
  handle text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_requests TO authenticated;
GRANT ALL ON public.channel_requests TO service_role;

ALTER TABLE public.channel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read channel requests"
  ON public.channel_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create their own channel requests"
  ON public.channel_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Users can update their own channel requests"
  ON public.channel_requests FOR UPDATE TO authenticated USING (auth.uid() = requested_by) WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Users can delete their own channel requests"
  ON public.channel_requests FOR DELETE TO authenticated USING (auth.uid() = requested_by);

CREATE TRIGGER channel_requests_updated_at BEFORE UPDATE ON public.channel_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();