import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CommsIQ - Test messages on 100 Kenyan personas" },
      {
        name: "description",
        content:
          "Test messages against personas with AI analysis, visualize reactions, and get personalized recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "CommsIQ - Test messages on 100 Kenyan personas" },
      {
        property: "og:description",
        content:
          "Test messages against personas with AI analysis, visualize reactions, and get personalized recommendations.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/setup" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <img
          src="/smait-logo.svg"
          alt="SMAIT logo"
          className="mx-auto h-12 w-auto"
        />
        <h1 className="type-section mt-4">CommsIQ</h1>
      </div>
    </div>
  );
}
