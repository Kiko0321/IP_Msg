"use client";

import { useEffect } from "react";
import { prefersDark } from "@/lib/theme";
import type { Theme } from "@/lib/validation/settings";

// Keeps the "dark" class in step after first paint: when the user saves a new theme (the layout
// re-renders with a new value) and, for "system", when the OS switches between light and dark.
export function ThemeSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", prefersDark(theme, media.matches));

    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
