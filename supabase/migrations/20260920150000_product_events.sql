-- Minimal product-analytics foundation. Records structured, name+property
-- events for the customer journey (signup, first useful result, sharing,
-- collaboration, return visits, conversion) - never brief/message/report
-- content, which stays entirely out of this table by construction (writers
-- only ever pass a small allowlisted property shape, enforced in
-- growth-events.server.ts, not at the database layer).

CREATE TABLE public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_events_workspace_idx ON public.product_events (workspace_id, created_at DESC);
CREATE INDEX product_events_name_idx ON public.product_events (event_name, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

-- Members can read their own workspace's events (for an eventual in-app
-- funnel view); writes go through the service-role client only, from
-- growth-events.server.ts, so a workspace member can never forge an event
-- for another workspace or inflate their own funnel from the client.
CREATE POLICY product_events_workspace_read ON public.product_events
  FOR SELECT TO authenticated
  USING (private.can_access_workspace(workspace_id));
