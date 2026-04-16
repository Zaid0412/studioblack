// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import {
  UserRoleProvider,
  useUserRoleContext,
} from "@/contexts/UserRoleContext";
import { useFileDropzone } from "@/hooks/useFileDropzone";

// ── usePageVisibility ────────────────────────────────────────────────────────

describe("usePageVisibility", () => {
  it("returns true when document is visible", () => {
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(true);
  });

  it("returns false when document is hidden", () => {
    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(false);
  });

  it("updates when visibility changes", () => {
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(false);
  });
});

// ── UserRoleProvider + useUserRoleContext ─────────────────────────────────────

describe("UserRoleProvider + useUserRoleContext", () => {
  it("provides role and userId to children", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserRoleProvider role="pm" userId="user-1">
        {children}
      </UserRoleProvider>
    );

    const { result } = renderHook(() => useUserRoleContext(), { wrapper });

    expect(result.current).toEqual({ role: "pm", userId: "user-1" });
  });

  it("returns null outside provider", () => {
    const { result } = renderHook(() => useUserRoleContext());

    expect(result.current).toBeNull();
  });

  it("provides architect role", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserRoleProvider role="architect" userId="user-2">
        {children}
      </UserRoleProvider>
    );

    const { result } = renderHook(() => useUserRoleContext(), { wrapper });

    expect(result.current).toEqual({ role: "architect", userId: "user-2" });
  });

  it("provides client role", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserRoleProvider role="client" userId="user-3">
        {children}
      </UserRoleProvider>
    );

    const { result } = renderHook(() => useUserRoleContext(), { wrapper });

    expect(result.current).toEqual({ role: "client", userId: "user-3" });
  });
});

// ── useFileDropzone ──────────────────────────────────────────────────────────

describe("useFileDropzone", () => {
  it("starts with dragOver false", () => {
    const addFiles = vi.fn();
    const { result } = renderHook(() => useFileDropzone(addFiles));

    expect(result.current.dragOver).toBe(false);
  });

  it("sets dragOver true on dragOver event", () => {
    const addFiles = vi.fn();
    const { result } = renderHook(() => useFileDropzone(addFiles));

    act(() => {
      result.current.handleDragOver({
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent);
    });

    expect(result.current.dragOver).toBe(true);
  });

  it("sets dragOver false on dragLeave", () => {
    const addFiles = vi.fn();
    const { result } = renderHook(() => useFileDropzone(addFiles));

    act(() => {
      result.current.handleDragOver({
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent);
    });
    expect(result.current.dragOver).toBe(true);

    act(() => {
      result.current.handleDragLeave();
    });
    expect(result.current.dragOver).toBe(false);
  });

  it("calls addFiles and resets dragOver on drop", () => {
    const addFiles = vi.fn();
    const { result } = renderHook(() => useFileDropzone(addFiles));

    const mockFiles = { length: 2 } as FileList;

    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: mockFiles },
      } as unknown as React.DragEvent);
    });

    expect(addFiles).toHaveBeenCalledWith(mockFiles);
    expect(result.current.dragOver).toBe(false);
  });

  it("does not call addFiles when no files dropped", () => {
    const addFiles = vi.fn();
    const { result } = renderHook(() => useFileDropzone(addFiles));

    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: { length: 0 } },
      } as unknown as React.DragEvent);
    });

    expect(addFiles).not.toHaveBeenCalled();
  });
});
