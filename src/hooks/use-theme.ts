import { useCallback, useEffect, useState } from "react";
import { readWithLegacyKey } from "@/lib/legacy-storage";

type Theme = "light" | "dark";

const KEY = "smait-theme";
const LEGACY_KEY = "fkf-commsiq-theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  // Dark is the product default; a stored "light" choice is the only thing
  // that overrides it. Kept in sync with the pre-hydration script in
  // __root.tsx so there's no flash of the wrong theme on first paint.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = readWithLegacyKey(KEY, LEGACY_KEY);
    const next: Theme = stored === "light" ? "light" : "dark";
    setThemeState(next);
    apply(next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    apply(next);
    window.localStorage.setItem(KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      apply(next);
      window.localStorage.setItem(KEY, next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
