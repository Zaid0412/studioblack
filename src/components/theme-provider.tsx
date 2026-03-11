"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { defaultTheme, lightTheme, type Theme } from "@/config/themes";

/* ─── Types ─── */
type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  /** The active theme object. */
  theme: Theme;
  /** Current mode: "dark" | "light". */
  mode: ThemeMode;
  /** Toggle between dark and light mode. */
  toggleTheme: () => void;
}

const STORAGE_KEY = "studioblack-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/* ─── Helper: apply tokens to :root ─── */
function applyTheme(theme: Theme) {
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
}

/* ─── Provider ─── */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provides theme context with dark/light mode switching and
 * localStorage persistence.
 *
 * Wrap the app in this provider so all Tailwind utilities that reference
 * `var(--bg-primary)`, `var(--accent)`, `var(--font-sans)`, etc. resolve
 * to the active theme.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  // Sync persisted preference on mount (SSR renders "dark", client corrects)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light") setMode("light"); // eslint-disable-line react-hooks/set-state-in-effect -- sync from external store on mount
  }, []);

  const theme = mode === "dark" ? defaultTheme : lightTheme;

  // Apply CSS custom properties whenever mode changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ─── Hook ─── */

/**
 * Access the current theme, mode, and toggle function.
 *
 * Must be used within a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
