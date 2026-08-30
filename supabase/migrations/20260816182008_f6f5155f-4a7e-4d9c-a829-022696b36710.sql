REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_org() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_read_thread(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_org() TO service_role;
GRANT EXECUTE ON FUNCTION public.can_read_thread(uuid) TO service_role;