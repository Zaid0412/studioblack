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

/** All CSS custom-property keys ever set, so we can clean up stale vars. */
let appliedKeys: string[] = [];

/* ─── Helper: apply tokens to :root ─── */
function applyTheme(theme: Theme, mode: ThemeMode) {
  const root = document.documentElement;

  // Remove stale vars from a previous theme that may have had extra keys
  for (const key of appliedKeys) {
    root.style.removeProperty(`--${key}`);
  }

  // Apply color tokens
  const keys: string[] = [];
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
    keys.push(key);
  }

  // Apply font tokens
  if (theme.font) {
    if (theme.font.sans) {
      root.style.setProperty("--font-sans", theme.font.sans);
      keys.push("font-sans");
    }
    if (theme.font.heading) {
      root.style.setProperty("--font-heading", theme.font.heading);
      keys.push("font-heading");
    }
  }

  appliedKeys = keys;

  // Keep data-theme attr in sync (used by CSS fallback to prevent FOUC)
  if (mode === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
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
  const [mode, setMode] = useState<ThemeMode>("light");

  // Sync persisted preference on mount (SSR renders "light", client corrects)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") setMode("dark"); // eslint-disable-line react-hooks/set-state-in-effect -- sync from external store on mount
  }, []);

  const theme = mode === "dark" ? defaultTheme : lightTheme;

  // Apply CSS custom properties whenever mode changes
  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode]);

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
