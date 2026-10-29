import { useSyncExternalStore } from "react";

export const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function isDesktopWindow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_QUERY).matches
  );
}

/** A window wide enough for the desktop shell: rail, sidebar, page and assistant side by side. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktopWindow, () => false);
}
