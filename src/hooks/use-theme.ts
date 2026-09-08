import { useCallback, useEffect, useState } from "react";
import { readWithLegacyKey } from "@/lib/legacy-storage";

type Theme = "light" | "dark";

const KEY = "smait-theme";
const LEGACY_KEY = "fkf-commsiq-theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = readWithLegacyKey(KEY, LEGACY_KEY);
    const next: Theme = stored === "dark" ? "dark" : "light";
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
