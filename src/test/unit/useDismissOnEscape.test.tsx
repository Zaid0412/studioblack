// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDismissOnEscape } from "@/hooks/useDismissOnEscape";

function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  // No global cleanup needed — each test uses its own renderHook.
});

describe("useDismissOnEscape", () => {
  it("calls onDismiss when Escape is pressed while active", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(true, onDismiss));

    pressKey("Escape");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onDismiss when active is false", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(false, onDismiss));

    pressKey("Escape");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnEscape(true, onDismiss));

    pressKey("Enter");
    pressKey(" ");
    pressKey("a");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stops listening when active flips to false", () => {
    const onDismiss = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useDismissOnEscape(active, onDismiss),
      { initialProps: { active: true } }
    );

    pressKey("Escape");
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    pressKey("Escape");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const onDismiss = vi.fn();
    const { unmount } = renderHook(() => useDismissOnEscape(true, onDismiss));

    unmount();
    pressKey("Escape");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("uses the latest onDismiss callback without re-attaching listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useDismissOnEscape(true, cb),
      { initialProps: { cb: first } }
    );

    rerender({ cb: second });
    pressKey("Escape");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
