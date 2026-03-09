"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface SidebarContextValue {
  /** Whether the sidebar is in collapsed (icon-only) mode. */
  isCollapsed: boolean;
  /** Toggle between collapsed and expanded states. */
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

/**
 * Provides sidebar collapse state to the layout tree.
 *
 * Wrap both the `<Sidebar>` and `<main>` content areas so they can
 * coordinate width changes when the sidebar is toggled.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * Returns the current sidebar collapse state and toggle function.
 *
 * Must be used within a `<SidebarProvider>`.
 */
export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a <SidebarProvider>");
  }
  return ctx;
}
