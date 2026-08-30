import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const KEY = "fkf-commsiq-theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
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
