import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSetupStatus } from "@/lib/onboarding.functions";
import type { SetupStatus } from "@/lib/onboarding";

/** The signed-in user's setup answers (brand name, handle, monitoring terms). */
export function useSetupStatus() {
  const fetchStatus = useServerFn(getSetupStatus);
  return useQuery<SetupStatus>({
    queryKey: ["setup-status"],
    queryFn: () => fetchStatus(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Human sentence describing what the workspace listens for, from setup answers. */
export function watchedSubjectsLabel(
  status: SetupStatus | undefined,
  fallbackHandles: readonly string[],
): string {
  const handles: string[] = [];
  if (status?.brandHandle) handles.push(`@${status.brandHandle.replace(/^@/, "")}`);
  if (handles.length === 0 && status?.brandName) handles.push(status.brandName);
  if (handles.length === 0) handles.push(...fallbackHandles.map((h) => `@${h.replace(/^@/, "")}`));

  const terms = (status?.keywords ?? []).slice(0, 3);
  const subjects = join(handles);
  return terms.length ? `${subjects}, plus ${join(terms)}` : subjects;
}

function join(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
