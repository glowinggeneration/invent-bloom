import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getProfile } from "@/lib/smait.functions";
import type { Profile } from "@/lib/threads";

export function useProfile() {
  const fetchProfile = useServerFn(getProfile);
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    staleTime: 5 * 60 * 1000,
  });
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
}
