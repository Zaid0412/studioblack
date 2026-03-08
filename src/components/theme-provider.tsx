"use client";

import { useEffect } from "react";
import { defaultTheme, type Theme } from "@/config/themes";

interface ThemeProviderProps {
  theme?: Theme;
  children: React.ReactNode;
}

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
