-- Multi-tenant SaaS conversion, Phase 3: self-serve signup.
--
-- handle_new_user() used to assign every signup into the one shared
-- workspace as 'team' or 'external' by email-domain match. Gated on Phase 2
-- being fully shipped: from here on, every fresh signup instead gets a
-- brand-new, fully isolated workspace of their own, with themselves as its
-- 'owner' member. The existing admin-provisioned Workspace 1 (and its
-- current members) are completely untouched by this change - this only
-- changes what happens for auth.users rows created from here forward.
--
-- This also fixes a live bug: the previous version read
-- workspace_settings WHERE singleton = true, a column Phase 2b's own
-- migration (20260909123000) already dropped. Every new-user trigger fire
-- since that migration landed has been throwing "column does not exist" -
-- masked so far only because no signup UI exists yet to trigger it.
--
-- profiles.org is kept (not dropped - still the "migrate" step, not
-- "contract") and set to 'team' for new signups: a workspace's own owner is
-- a full member of their own workspace, not an "external collaborator" the
-- way that flag meant under the old single-shared-workspace model. It no
-- longer drives any RLS decision (Phase 2b re-pointed every policy at
-- workspace_id), only a couple of cosmetic UI labels
-- (profile.tsx/shared.tsx/dashboard.tsx).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_workspace_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.workspaces (name, owner_user_id)
  VALUES (display_name || '''s workspace', NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  INSERT INTO public.profiles (id, email, full_name, org, workspace_id)
  VALUES (NEW.id, NEW.email, display_name, 'team', new_workspace_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
