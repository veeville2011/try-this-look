import * as React from "react";

// Standardized to Tailwind's lg breakpoint (1024px) for consistency
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Check if parent window told us it's desktop (for iframe scenarios)
    // When iframe is 900px but parent is desktop, we should render desktop layout
    const urlParams = new URLSearchParams(window.location.search);
    const parentIsDesktop = urlParams.get("parentIsDesktop");
    
    const determineIsMobile = () => {
      // If parent explicitly says it's desktop, trust that
      // OR if iframe itself is wide enough (>= 1024px), use desktop layout
      if (parentIsDesktop === "true" || window.innerWidth >= MOBILE_BREAKPOINT) {
        return false; // Desktop
      }
      // Otherwise, check if iframe is mobile-sized
      return window.innerWidth < MOBILE_BREAKPOINT;
    };
    
    setIsMobile(determineIsMobile());
    
    // Set up media query listener for resize events
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(determineIsMobile());
    };
    mql.addEventListener("change", onChange);
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
