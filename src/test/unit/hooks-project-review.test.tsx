// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPinList = vi.fn();
const mockPinCreate = vi.fn();
const mockPinResolve = vi.fn();
const mockPinSetStatus = vi.fn();
const mockPinEditContent = vi.fn();
const mockPinRemove = vi.fn();
const mockPinReposition = vi.fn();
const mockPinListReplies = vi.fn();

const mockCommentsCreate = vi.fn();
const mockApprovalsSubmit = vi.fn();
const mockTasksSubmitReview = vi.fn();

const mockToast = vi.fn();
const mockDownloadFile = vi.fn();

vi.mock("@/lib/api", () => ({
  pinComments: {
    list: (...args: unknown[]) => mockPinList(...args),
    create: (...args: unknown[]) => mockPinCreate(...args),
    resolve: (...args: unknown[]) => mockPinResolve(...args),
    setStatus: (...args: unknown[]) => mockPinSetStatus(...args),
    editContent: (...args: unknown[]) => mockPinEditContent(...args),
    remove: (...args: unknown[]) => mockPinRemove(...args),
    reposition: (...args: unknown[]) => mockPinReposition(...args),
    listReplies: (...args: unknown[]) => mockPinListReplies(...args),
  },
  comments: {
    create: (...args: unknown[]) => mockCommentsCreate(...args),
  },
  approvals: {
    submit: (...args: unknown[]) => mockApprovalsSubmit(...args),
  },
  tasks: {
    submitReview: (...args: unknown[]) => mockTasksSubmitReview(...args),
  },
}));

vi.mock("@/lib/api/routes", () => ({
  API: {
    attachmentPins: (pid: string, fid: string) =>
      `/api/projects/${pid}/attachments/${fid}/pins`,
  },
}));

vi.mock("@/components/ui/useToast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/lib/download", () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

beforeEach(() => vi.clearAllMocks());

// ── usePinComments ────────────────────────────────────────────────���──────────

import { usePinComments } from "@/hooks/usePinComments";
import type { DbPinComment, DbAttachment } from "@/types";

function makePin(overrides: Partial<DbPinComment> = {}): DbPinComment {
  // Keep the DB invariant: status tracks `resolved` unless set explicitly.
  const resolved = overrides.resolved ?? false;
  return {
    id: "pin-1",
    attachment_id: "att-1",
    user_id: "user-1",
    user_name: "Zaid",
    x_percent: 50,
    y_percent: 50,
    page: 1,
    content: "Test comment",
    resolved,
    status: overrides.status ?? (resolved ? "resolved" : "open"),
    task_id: null,
    request_approval: false,
    request_changes: false,
    parent_id: null,
    updated_at: null,
    reply_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("usePinComments", () => {
  const params = {
    projectId: "proj-1",
    attachmentId: "att-1",
    userName: "Zaid",
  };

  /** Custom SWR fetcher that delegates to pinComments.list (matching hook behavior). */
  function pinSwrWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      SWRConfig,
      {
        value: {
          provider: () => new Map(),
          dedupingInterval: 0,
          fetcher: (key: string) => {
            // The hook uses API.attachmentPins as SWR key — the global fetcher
            // calls apiGet which we don't mock. Instead, intercept and delegate
            // to the mock pinComments.list.
            if (key.includes("/pins")) {
              return mockPinList("proj-1", "att-1");
            }
            return Promise.resolve(undefined);
          },
        },
      },
      children
    );
  }

  it("starts with loading=true and fetches pins on mount", async () => {
    const pins = [makePin()];
    mockPinList.mockResolvedValue(pins);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockPinList).toHaveBeenCalledWith("proj-1", "att-1");
    expect(result.current.pins).toEqual(pins);
  });

  it("shows error toast when initial fetch fails", async () => {
    mockPinList.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to load comments",
      })
    );
  });

  it("addPin: optimistically adds a temp pin, replaces with real on success", async () => {
    mockPinList.mockResolvedValue([]);
    const realPin = makePin({ id: "real-1", content: "Hello" });
    mockPinCreate.mockResolvedValue(realPin);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addPin({
        content: "Hello",
        xPercent: 10,
        yPercent: 20,
        page: 1,
      });
    });

    expect(mockPinCreate).toHaveBeenCalledWith(
      "proj-1",
      "att-1",
      expect.objectContaining({
        content: "Hello",
        x_percent: 10,
        y_percent: 20,
        page: 1,
      })
    );
    expect(result.current.pins).toHaveLength(1);
    expect(result.current.pins[0].id).toBe("real-1");
  });

  it("addPin: rolls back temp pin on failure", async () => {
    mockPinList.mockResolvedValue([]);
    mockPinCreate.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addPin({ content: "Fail" });
    });

    expect(result.current.pins).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to add comment",
      })
    );
  });

  it("resolvePin: optimistically resolves, rolls back on failure", async () => {
    mockPinList.mockResolvedValue([makePin({ id: "pin-1", resolved: false })]);
    mockPinResolve.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Optimistic update
    await act(async () => {
      await result.current.resolvePin("pin-1", true);
    });

    // Rolled back
    expect(result.current.pins[0].resolved).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to update comment",
      })
    );
  });

  it("resolvePin: updates resolved status on success", async () => {
    mockPinList.mockResolvedValue([makePin({ id: "pin-1", resolved: false })]);
    mockPinResolve.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolvePin("pin-1", true);
    });

    expect(result.current.pins[0].resolved).toBe(true);
  });

  it("setPinStatus: optimistically sets status + keeps resolved in sync", async () => {
    mockPinList.mockResolvedValue([
      makePin({ id: "pin-1", status: "open", resolved: false }),
    ]);
    mockPinSetStatus.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setPinStatus("pin-1", "resolved");
    });

    expect(result.current.pins[0].status).toBe("resolved");
    expect(result.current.pins[0].resolved).toBe(true);
    expect(mockPinSetStatus).toHaveBeenCalledWith(
      "proj-1",
      "att-1",
      "pin-1",
      "resolved"
    );

    // Closing a pin drops it from the open (unresolved) count.
    await act(async () => {
      await result.current.setPinStatus("pin-1", "closed");
    });
    expect(result.current.pins[0].resolved).toBe(false);
    expect(result.current.unresolvedCount).toBe(0);
  });

  it("editPin: optimistically updates content", async () => {
    mockPinList.mockResolvedValue([makePin({ id: "pin-1", content: "Old" })]);
    mockPinEditContent.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.editPin("pin-1", "New content");
    });

    expect(result.current.pins[0].content).toBe("New content");
    expect(mockPinEditContent).toHaveBeenCalledWith(
      "proj-1",
      "att-1",
      "pin-1",
      "New content"
    );
  });

  it("deletePin: removes pin optimistically, refetches on failure", async () => {
    const pin = makePin({ id: "pin-1" });
    mockPinList.mockResolvedValue([pin]);
    mockPinRemove.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deletePin("pin-1");
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to delete comment",
      })
    );
    // After SWR revalidation, pin is restored
    await waitFor(() => expect(result.current.pins).toHaveLength(1));
  });

  it("repositionPin: updates coordinates optimistically", async () => {
    mockPinList.mockResolvedValue([
      makePin({ id: "pin-1", x_percent: 10, y_percent: 20 }),
    ]);
    mockPinReposition.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.repositionPin("pin-1", 80, 90, 2);
    });

    expect(result.current.pins[0].x_percent).toBe(80);
    expect(result.current.pins[0].y_percent).toBe(90);
    expect(result.current.pins[0].page).toBe(2);
    expect(mockPinReposition).toHaveBeenCalledWith("proj-1", "att-1", "pin-1", {
      x_percent: 80,
      y_percent: 90,
      page: 2,
    });
  });

  it("fetchReplies: populates repliesMap on success", async () => {
    mockPinList.mockResolvedValue([makePin({ id: "pin-1" })]);
    const replies = [makePin({ id: "reply-1", parent_id: "pin-1" })];
    mockPinListReplies.mockResolvedValue(replies);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.fetchReplies("pin-1");
    });

    expect(result.current.repliesMap.get("pin-1")).toEqual(replies);
  });

  it("addReply: appends to repliesMap and increments parent reply_count", async () => {
    mockPinList.mockResolvedValue([makePin({ id: "pin-1", reply_count: 0 })]);
    const reply = makePin({
      id: "reply-1",
      parent_id: "pin-1",
      content: "Reply!",
    });
    mockPinCreate.mockResolvedValue(reply);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReply("pin-1", "Reply!");
    });

    expect(result.current.repliesMap.get("pin-1")).toEqual([reply]);
    expect(result.current.pins[0].reply_count).toBe(1);
  });

  it("unresolvedCount: counts unresolved pins", async () => {
    mockPinList.mockResolvedValue([
      makePin({ id: "pin-1", resolved: false }),
      makePin({ id: "pin-2", resolved: true }),
      makePin({ id: "pin-3", resolved: false }),
    ]);

    const { result } = renderHook(() => usePinComments(params), {
      wrapper: pinSwrWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unresolvedCount).toBe(2);
  });
});

// ── useProjectDetail ─────────────────────────────────────────────────────────

import { useProjectDetail } from "@/hooks/useProjectDetail";

/**
 * Wrapper for hooks that use useSWR via other hooks (useProjectDetail, useDesignReview)
 * but we only want to test the non-SWR logic. Provides a fresh SWR cache with a
 * no-op fetcher that returns undefined.
 */
function noopSwrWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    {
      value: {
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: () => Promise.resolve(undefined),
      },
    },
    children
  );
}

describe("useProjectDetail", () => {
  it("submitComment: calls comments.create and returns true on success", async () => {
    mockCommentsCreate.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectDetail("proj-1"), {
      wrapper: noopSwrWrapper,
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.submitComment("Hello world");
    });

    expect(mockCommentsCreate).toHaveBeenCalledWith("proj-1", "Hello world");
    expect(outcome).toBe(true);
  });

  it("submitComment: returns false and skips API call when text is empty", async () => {
    const { result } = renderHook(() => useProjectDetail("proj-1"), {
      wrapper: noopSwrWrapper,
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.submitComment("   ");
    });

    expect(mockCommentsCreate).not.toHaveBeenCalled();
    expect(outcome).toBe(false);
  });

  it("submitComment: shows error toast and returns false on failure", async () => {
    mockCommentsCreate.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useProjectDetail("proj-1"), {
      wrapper: noopSwrWrapper,
    });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.submitComment("Test");
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to send comment",
      })
    );
    expect(outcome).toBe(false);
  });

  it("handleDecision: calls approvals.submit", async () => {
    mockApprovalsSubmit.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useProjectDetail("proj-1", { includeApprovals: true }),
      { wrapper: noopSwrWrapper }
    );

    await act(async () => {
      await result.current.handleDecision("approved", "Looks good");
    });

    expect(mockApprovalsSubmit).toHaveBeenCalledWith("proj-1", {
      decision: "approved",
      comment: "Looks good",
    });
    expect(result.current.submittingDecision).toBe(false);
  });

  it("handleDecision: shows error toast on failure", async () => {
    mockApprovalsSubmit.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(
      () => useProjectDetail("proj-1", { includeApprovals: true }),
      { wrapper: noopSwrWrapper }
    );

    await act(async () => {
      await result.current.handleDecision("changes_requested", "Fix this");
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        description: "Failed to submit decision",
      })
    );
  });

  it("handleDownload: delegates to downloadFile", async () => {
    mockDownloadFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectDetail("proj-1"), {
      wrapper: noopSwrWrapper,
    });

    const att = {
      file_url: "https://cdn/file.pdf",
      file_name: "file.pdf",
    } as DbAttachment;
    await act(async () => {
      await result.current.handleDownload(att);
    });

    expect(mockDownloadFile).toHaveBeenCalledWith(
      "https://cdn/file.pdf",
      "file.pdf"
    );
  });
});

// ── useDesignReview ──────────────────────────────────────────────────────────

import { useDesignReview } from "@/hooks/useDesignReview";

describe("useDesignReview", () => {
  it("initializes with designId as activeFileId", async () => {
    const { result } = renderHook(
      () =>
        useDesignReview({
          projectId: "proj-1",
          designId: "design-1",
          basePath: "/projects",
        }),
      { wrapper: noopSwrWrapper }
    );

    expect(result.current.activeFileId).toBe("design-1");
    // Noop fetcher resolves to undefined, so attachment stays null
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attachment).toBeNull();
  });

  it("setActiveFileId updates activeFileId and replaces URL", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    const { result } = renderHook(
      () =>
        useDesignReview({
          projectId: "proj-1",
          designId: "design-1",
          basePath: "/projects",
        }),
      { wrapper: noopSwrWrapper }
    );

    act(() => result.current.setActiveFileId("design-2"));

    expect(result.current.activeFileId).toBe("design-2");
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/projects/proj-1/review/design-2"
    );

    replaceStateSpy.mockRestore();
  });

  it("does not replace URL when activeFileId matches designId", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderHook(
      () =>
        useDesignReview({
          projectId: "proj-1",
          designId: "design-1",
          basePath: "/projects",
        }),
      { wrapper: noopSwrWrapper }
    );

    // Should not have been called since activeFileId === designId
    expect(replaceStateSpy).not.toHaveBeenCalled();

    replaceStateSpy.mockRestore();
  });
});

// ── useSlide ─────────────────────────────────────────────────────────────────

import { useSlide } from "@/components/review/useSlide";

describe("useSlide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(cb, 0)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns shouldRender=true and stage='in' when open", () => {
    const { result } = renderHook(() => useSlide(true));

    // Initially stage is "in" from useState init since open=true
    // After double-rAF, stage transitions to "in"
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.stage).toBe("in");
  });

  it("transitions through closing animation when open goes false", () => {
    const { result, rerender } = renderHook(({ open }) => useSlide(open, 200), {
      initialProps: { open: true },
    });

    // Ensure open state
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.stage).toBe("in");

    // Close
    rerender({ open: false });

    // After rAF fires, stage becomes "out" and closing=true
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.stage).toBe("out");

    // After duration, closing finishes
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.stage).toBeNull();
  });

  it("starts with shouldRender=false when initially closed", () => {
    const { result } = renderHook(() => useSlide(false));

    // rAF fires but since no prior open, closing starts then ends
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.stage).toBeNull();
  });
});
