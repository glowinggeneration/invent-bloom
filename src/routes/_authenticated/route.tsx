import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const next = `${location.pathname}${location.searchStr}${location.hash}`;
      throw redirect({ to: "/auth", search: { next } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
