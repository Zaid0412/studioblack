// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "@/hooks/useLongPress";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLongPress — firing", () => {
  it("invokes onLongPress after durationMs when start() is called", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { durationMs: 300, haptic: false })
    );

    act(() => {
      result.current.start(undefined);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("passes the start() arg through to the callback (typed variant)", () => {
    const onLongPress = vi.fn<(id: string) => void>();
    const { result } = renderHook(() =>
      useLongPress<string>(onLongPress, { durationMs: 100, haptic: false })
    );

    act(() => {
      result.current.start("doc-42");
      vi.advanceTimersByTime(100);
    });

    expect(onLongPress).toHaveBeenCalledWith("doc-42");
  });

  it("calls navigator.vibrate(15) on fire when haptic is enabled", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useLongPress(() => {}, { durationMs: 50, haptic: true })
    );
    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(50);
    });

    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it("skips navigator.vibrate when haptic is false", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      useLongPress(() => {}, { durationMs: 50, haptic: false })
    );
    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(50);
    });

    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe("useLongPress — cancel", () => {
  it("cancel() aborts a pending fire", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { durationMs: 200, haptic: false })
    );

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(100);
      result.current.cancel();
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() =>
      useLongPress(onLongPress, { durationMs: 200, haptic: false })
    );

    act(() => {
      result.current.start(undefined);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("touchEnd / touchMove / touchCancel handlers all cancel", () => {
    for (const key of ["onTouchEnd", "onTouchMove", "onTouchCancel"] as const) {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { durationMs: 100, haptic: false })
      );

      act(() => {
        result.current.handlers.onTouchStart();
        vi.advanceTimersByTime(50);
        result.current.handlers[key]();
        vi.advanceTimersByTime(200);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    }
  });
});

describe("useLongPress — consumeFired", () => {
  it("returns true once after a fire and false thereafter", () => {
    const { result } = renderHook(() =>
      useLongPress(() => {}, { durationMs: 50, haptic: false })
    );

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(50);
    });

    expect(result.current.consumeFired()).toBe(true);
    // Read-and-clear — second read sees nothing.
    expect(result.current.consumeFired()).toBe(false);
  });

  it("returns false when the gesture was cancelled before firing", () => {
    const { result } = renderHook(() =>
      useLongPress(() => {}, { durationMs: 100, haptic: false })
    );

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(50);
      result.current.cancel();
    });

    expect(result.current.consumeFired()).toBe(false);
  });
});

describe("useLongPress — enabled gate", () => {
  it("start() is a no-op when enabled is false", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, {
        enabled: false,
        durationMs: 50,
        haptic: false,
      })
    );

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire if enabled flips false mid-gesture (race guard)", () => {
    const onLongPress = vi.fn();
    let enabled = true;
    const { result, rerender } = renderHook(
      ({ enabled: e }) =>
        useLongPress(onLongPress, {
          enabled: e,
          durationMs: 200,
          haptic: false,
        }),
      { initialProps: { enabled } }
    );

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(100);
    });

    // Parent flips off mid-press (e.g. another path already entered the mode).
    enabled = false;
    rerender({ enabled });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe("useLongPress — handlers bundle", () => {
  it("handlers.onTouchStart drives the no-arg flow", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { durationMs: 50, haptic: false })
    );

    act(() => {
      result.current.handlers.onTouchStart();
      vi.advanceTimersByTime(50);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("preventContextMenu calls preventDefault only after a fire", () => {
    const { result } = renderHook(() =>
      useLongPress(() => {}, { durationMs: 50, haptic: false })
    );

    const idleEvt = { preventDefault: vi.fn() };
    result.current.preventContextMenu(idleEvt as never);
    expect(idleEvt.preventDefault).not.toHaveBeenCalled();

    act(() => {
      result.current.start(undefined);
      vi.advanceTimersByTime(50);
    });
    const firedEvt = { preventDefault: vi.fn() };
    result.current.preventContextMenu(firedEvt as never);
    expect(firedEvt.preventDefault).toHaveBeenCalledTimes(1);
  });
});
