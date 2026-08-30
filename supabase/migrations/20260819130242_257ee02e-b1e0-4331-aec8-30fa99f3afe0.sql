-- 1. user_roles: block all client-side writes; only service role can change roles
DROP POLICY IF EXISTS "user_roles_no_client_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_delete" ON public.user_roles;
CREATE POLICY "user_roles_no_client_insert" ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "user_roles_no_client_update" ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_no_client_delete" ON public.user_roles FOR DELETE TO authenticated, anon USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT ALL ON public.user_roles TO service_role;

-- 2. x_login_attempts: credentials/TOTP secrets - no client access at all
REVOKE ALL ON public.x_login_attempts FROM authenticated, anon;
GRANT ALL ON public.x_login_attempts TO service_role;
ALTER TABLE public.x_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "x_login_attempts_no_client_access" ON public.x_login_attempts;
CREATE POLICY "x_login_attempts_no_client_access" ON public.x_login_attempts FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- 3. campaign_skip_audit: owner-scoped reads
DROP POLICY IF EXISTS "Shared workspace read" ON public.campaign_skip_audit;
DROP POLICY IF EXISTS "campaign_skip_audit_shared_read" ON public.campaign_skip_audit;
DROP POLICY IF EXISTS "campaign_skip_audit_select" ON public.campaign_skip_audit;
CREATE POLICY "campaign_skip_audit_select" ON public.campaign_skip_audit FOR SELECT TO authenticated USING (user_id = auth.uid());