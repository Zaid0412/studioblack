"use client";

import { useEffect } from "react";
import { defaultTheme, type Theme } from "@/config/themes";

interface ThemeProviderProps {
  theme?: Theme;
  children: React.ReactNode;
}

/**
 * Applies a {@link Theme}'s colour and font tokens as CSS custom properties
 * on `:root`.
 *
 * Wrap the app in this provider so all Tailwind utilities that reference
 * `var(--bg-primary)`, `var(--accent)`, `var(--font-sans)`, etc. resolve
 * to the active theme.
 */
export function ThemeProvider({
  theme = defaultTheme,
  children,
}: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;

    // Apply color tokens
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--${key}`, value);
    }

    // Apply font tokens
    if (theme.font) {
      if (theme.font.sans) {
        root.style.setProperty("--font-sans", theme.font.sans);
      }
      if (theme.font.heading) {
        root.style.setProperty("--font-heading", theme.font.heading);
      }
    }
  }, [theme]);

  return <>{children}</>;
}
