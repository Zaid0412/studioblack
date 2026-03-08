"use client";

import { useEffect } from "react";
import { defaultTheme, type Theme } from "@/config/themes";

interface ThemeProviderProps {
  theme?: Theme;
  children: React.ReactNode;
}

/**
 * Applies a {@link Theme}'s colour tokens as CSS custom properties on `:root`.
 *
 * Wrap the app in this provider so all Tailwind utilities that reference
 * `var(--bg-primary)`, `var(--accent)`, etc. resolve to the active theme.
 */
export function ThemeProvider({
  theme = defaultTheme,
  children,
}: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--${key}`, value);
    }
  }, [theme]);

  return <>{children}</>;
}
