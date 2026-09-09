-- Phase 2c correction: persona_images, persona_state and persona_learning_events
-- are keyed by persona_id against the fixed, built-in PERSONAS catalog (see
-- src/lib/personas.ts), not tenant-created data - every workspace has the
-- exact same set of personas. Phase 1/2b added workspace_id and workspace-
-- scoped RLS to them along with the rest of the 37 tenant tables, but their
-- primary keys were never made composite (persona_id remains the sole PK),
-- so a second workspace's admin-triggered syncPersonaImages or the AI's
-- recordPersonaOutcome upsert would either violate that PK or silently steal
-- the row's workspace_id away from whichever workspace wrote it first.
--
-- Decision (confirmed): keep this data global and shared across every
-- workspace - the AI's tone/phrasing adaptation should compound across all
-- platform usage rather than every new signup's personas starting cold, and
-- persona artwork is decorative stock photography, not tenant-owned content.
-- This reverts the workspace scoping added in Phase 1/2b for these three
-- tables only; every other table's workspace_id stays exactly as Phase 2b
-- left it.
--
-- external_profiles is the same case by the same reasoning (a shared cache
-- of public X profile data - see resolveExternalProfiles' own docstring),
-- and has the same live bug: Phase 1 gave it a NOT NULL workspace_id but
-- Phase 2b correctly never touched its RLS (still USING (true)), so its
-- upsert - which never set workspace_id - would fail that constraint the
-- moment it ran. Folded into the same correction.

DROP POLICY IF EXISTS "Workspace members can read persona images" ON public.persona_images;
CREATE POLICY "Persona images readable by signed-in users" ON public.persona_images
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Workspace members can read persona state" ON public.persona_state;
CREATE POLICY "Signed-in users can read persona state"
  ON public.persona_state FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Workspace members can read learning events" ON public.persona_learning_events;
CREATE POLICY "Signed-in users can read learning events"
  ON public.persona_learning_events FOR SELECT TO authenticated USING (true);

DROP INDEX IF EXISTS public.persona_images_workspace_idx;
DROP INDEX IF EXISTS public.persona_state_workspace_idx;
DROP INDEX IF EXISTS public.persona_learning_events_workspace_idx;
DROP INDEX IF EXISTS public.external_profiles_workspace_idx;

ALTER TABLE public.persona_images DROP COLUMN workspace_id;
ALTER TABLE public.persona_state DROP COLUMN workspace_id;
ALTER TABLE public.persona_learning_events DROP COLUMN workspace_id;
ALTER TABLE public.external_profiles DROP COLUMN workspace_id;
