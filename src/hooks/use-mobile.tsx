import * as React from "react";

/**
 * Touch-first compact shell breakpoint.
 *
 * Phones and tablets below 1024px use the off-canvas navigation instead of the
 * hover/collapsed desktop rail. This keeps iPad-sized screens predictable and
 * leaves more horizontal room for tables, charts and campaign controls.
 */
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
