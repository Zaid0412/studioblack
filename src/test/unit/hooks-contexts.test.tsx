// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/* ─── Mocks ─── */

vi.mock("@/config/themes", () => ({
  defaultTheme: { colors: { "bg-primary": "#000" }, font: { sans: "Inter" } },
  lightTheme: { colors: { "bg-primary": "#fff" }, font: { sans: "Inter" } },
}));

/* ─── Imports (after mocks) ─── */

import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/SidebarContext";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

/* ────────────────────────────────────────────────────────────
 * SidebarContext
 * ──────────────────────────────────────────────────────────── */

describe("SidebarContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SidebarProvider>{children}</SidebarProvider>
  );

  it("throws when useSidebar is called outside SidebarProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSidebar())).toThrow(
      "useSidebar must be used within a <SidebarProvider>"
    );
    spy.mockRestore();
  });

  it("starts with isCollapsed = false", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });
    expect(result.current.isCollapsed).toBe(false);
  });

  it("toggle flips isCollapsed to true then back to false", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isCollapsed).toBe(false);
  });

  it("collapse sets isCollapsed to true", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    act(() => result.current.collapse());
    expect(result.current.isCollapsed).toBe(true);
  });

  it("collapse is idempotent", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });

    act(() => result.current.collapse());
    act(() => result.current.collapse());
    expect(result.current.isCollapsed).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────
 * ThemeProvider
 * ──────────────────────────────────────────────────────────── */

describe("ThemeProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    // Clean up CSS custom properties and data-theme from previous tests
    const root = document.documentElement;
    root.style.removeProperty("--bg-primary");
    root.style.removeProperty("--font-sans");
    root.removeAttribute("data-theme");
  });

  it("throws when useTheme is called outside ThemeProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a <ThemeProvider>"
    );
    spy.mockRestore();
  });

  it("defaults to mode = light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("light");
  });

  it("toggleTheme switches from light to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(result.current.mode).toBe("dark");
  });

  it("toggleTheme persists mode to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem("studioblack-theme-v2")).toBe("dark");

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem("studioblack-theme-v2")).toBe("light");
  });

  it("reads persisted dark mode from localStorage on mount", () => {
    localStorage.setItem("studioblack-theme-v2", "dark");

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("dark");
  });

  it("applies CSS custom properties to document.documentElement", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Light mode: lightTheme has bg-primary = #fff
    expect(
      document.documentElement.style.getPropertyValue("--bg-primary")
    ).toBe("#fff");

    act(() => result.current.toggleTheme());

    // Dark mode: defaultTheme has bg-primary = #000
    expect(
      document.documentElement.style.getPropertyValue("--bg-primary")
    ).toBe("#000");
  });

  it("sets data-theme='dark' in dark mode and removes it in light mode", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Light mode: no data-theme attribute
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    act(() => result.current.toggleTheme());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => result.current.toggleTheme());
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
