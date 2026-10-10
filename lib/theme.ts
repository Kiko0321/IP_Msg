import type { Theme } from "@/lib/validation/settings";

// MSG-22: the root <html> carries data-theme="system|light|dark" (from user_settings) and the
// "dark" class decides the colours. The class is only ever set on the client, by this script
// before first paint and by <ThemeSync> afterwards, so React never fights over it.

// Runs inline in <head>, before the page paints, so there's no flash of the wrong theme.
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var m=window.matchMedia("(prefers-color-scheme: dark)");var t=d.dataset.theme;d.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches));}catch(e){}})();`;

export function prefersDark(theme: Theme, systemDark: boolean) {
  return theme === "dark" || (theme === "system" && systemDark);
}
