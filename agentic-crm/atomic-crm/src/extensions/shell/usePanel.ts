import { useState } from "react";

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Whether a side panel is open: what the person last chose, or open when the window is at least
 * `wideFrom` pixels wide.
 */
export function usePanel(key: string, wideFrom: number) {
  const [open, setOpen] = useState(() => {
    const saved = read(key);
    if (saved !== null) return saved === "open";
    return window.matchMedia(`(min-width: ${wideFrom}px)`).matches;
  });
  const toggle = () =>
    setOpen((current) => {
      try {
        window.localStorage.setItem(key, current ? "closed" : "open");
      } catch {
        // Not remembered, but still toggled.
      }
      return !current;
    });
  return [open, toggle] as const;
}
