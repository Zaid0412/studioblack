// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
import type { Task, ChecklistItem, TaskAttachment } from "@/types";

// ── Mock fns ────────────────────────────────────────────────────────────────

const mockToast = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockToggleStar = vi.fn();
const mockAddChecklistItem = vi.fn();
const mockToggleChecklistItem = vi.fn();
const mockRemoveChecklistItem = vi.fn();
const mockReorderChecklist = vi.fn();
const mockGetChecklist = vi.fn();
const mockGetAttachments = vi.fn();
const mockAddAttachment = vi.fn();
const mockRemoveAttachment = vi.fn();
const mockUploadFile = vi.fn();
const mockDownloadFile = vi.fn();

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  tasks: {
    update: (...a: unknown[]) => mockUpdate(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    remove: (...a: unknown[]) => mockRemove(...a),
    toggleStar: (...a: unknown[]) => mockToggleStar(...a),
    addChecklistItem: (...a: unknown[]) => mockAddChecklistItem(...a),
    toggleChecklistItem: (...a: unknown[]) => mockToggleChecklistItem(...a),
    removeChecklistItem: (...a: unknown[]) => mockRemoveChecklistItem(...a),
    reorderChecklist: (...a: unknown[]) => mockReorderChecklist(...a),
    getChecklist: (...a: unknown[]) => mockGetChecklist(...a),
    getAttachments: (...a: unknown[]) => mockGetAttachments(...a),
    addAttachment: (...a: unknown[]) => mockAddAttachment(...a),
    removeAttachment: (...a: unknown[]) => mockRemoveAttachment(...a),
  },
  upload: {
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
  },
}));

vi.mock("@/components/ui/useToast", () => ({
  toast: (...a: unknown[]) => mockToast(...a),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/download", () => ({
  downloadFile: (...a: unknown[]) => mockDownloadFile(...a),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

beforeEach(() => vi.clearAllMocks());

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    org_id: "org1",
    project_id: "p1",
    phase_id: "ph1",
    title: "Test task",
    description: "",
    status: "todo",
    priority: "medium",
    category: "general",
    created_by: "u1",
    assigned_to: "u2",
    due_date: null,
    reminder_at: null,
    completed_at: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    assigned_to_name: null,
    created_by_name: "User",
    project_name: null,
    phase_name: null,
    is_starred: false,
    checklist_total: 0,
    checklist_done: 0,
    pin_comment_id: null,
    pin_attachment_id: null,
    ...overrides,
  };
}

function makeChecklistItem(
  overrides: Partial<ChecklistItem> = {}
): ChecklistItem {
  return {
    id: "ci1",
    task_id: "t1",
    title: "Item 1",
    is_done: false,
    position: 0,
    created_at: "2024-01-01",
    ...overrides,
  };
}

function makeAttachment(
  overrides: Partial<TaskAttachment> = {}
): TaskAttachment {
  return {
    id: "a1",
    standalone_task_id: "t1",
    file_url: "https://cdn/file.pdf",
    file_name: "file.pdf",
    file_size: 1024,
    uploaded_by: "u1",
    created_at: "2024-01-01",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// useTaskCrud
// ══════════════════════════════════════════════════════════════════════════════

import { useTaskCrud } from "@/hooks/useTaskCrud";

describe("useTaskCrud", () => {
  const fetchTasks = vi.fn();
  const setTasks = vi.fn();

  function setup(overrides = {}) {
    return renderHook(() =>
      useTaskCrud({
        fetchTasks,
        setTasks,
        ...overrides,
      })
    );
  }

  // ── toggleStatus ──────────────────────────────────────────────────────

  it("toggleStatus calls update with next status and refetches", async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { result } = setup();

    await act(() => result.current.toggleStatus(makeTask({ status: "todo" })));

    expect(mockUpdate).toHaveBeenCalledWith("t1", { status: "in_progress" });
    expect(fetchTasks).toHaveBeenCalled();
  });

  it("toggleStatus shows error toast on failure", async () => {
    mockUpdate.mockRejectedValue(new Error("fail"));
    const { result } = setup();

    await act(() => result.current.toggleStatus(makeTask()));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  // ── toggleStar ────────────────────────────────────────────────────────

  it("toggleStar optimistically updates tasks", async () => {
    mockToggleStar.mockResolvedValue(undefined);
    const { result } = setup();

    await act(() => result.current.toggleStar(makeTask({ is_starred: false })));

    expect(setTasks).toHaveBeenCalledTimes(1);
    expect(mockToggleStar).toHaveBeenCalledWith("t1");
  });

  it("toggleStar rolls back on API failure", async () => {
    mockToggleStar.mockRejectedValue(new Error("fail"));
    const { result } = setup();

    await act(() => result.current.toggleStar(makeTask({ is_starred: true })));

    // Called twice: optimistic + rollback
    expect(setTasks).toHaveBeenCalledTimes(2);
  });

  // ── openEdit ──────────────────────────────────────────────────────────

  it("openEdit routes to /tasks/[id]", () => {
    const { result } = setup();
    const task = makeTask({ id: "abc" });

    act(() => result.current.openEdit(task));

    expect(mockPush).toHaveBeenCalledWith("/tasks/abc");
  });

  // ── handleDelete (kept below) ─────────────────────────────────────────
  // Old form-driven `handleSubmit` / `openCreate` tests are gone — task
  // create + edit live at /tasks/new and /tasks/[id] in the new design.
  // The placeholder block keeps the original line range stable.

  it("legacy create/edit hook surface removed", () => {
    const { result } = setup();
    expect("handleSubmit" in result.current).toBe(false);
    expect("openCreate" in result.current).toBe(false);
    expect("formData" in result.current).toBe(false);
  });

  // ── handleDelete ──────────────────────────────────────────────────────

  it("handleDelete removes task and shows success toast", async () => {
    mockRemove.mockResolvedValue(undefined);
    const { result } = setup();

    act(() => result.current.setDeleteTarget(makeTask({ title: "Doomed" })));

    await act(() => result.current.handleDelete());

    expect(mockRemove).toHaveBeenCalledWith("t1");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Task deleted" })
    );
    expect(fetchTasks).toHaveBeenCalled();
    expect(result.current.deleteTarget).toBeNull();
  });

  it("handleDelete shows error toast on failure", async () => {
    mockRemove.mockRejectedValue(new Error("fail"));
    const { result } = setup();

    act(() => result.current.setDeleteTarget(makeTask()));

    await act(() => result.current.handleDelete());

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(result.current.deleting).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// useTaskDetail
// ══════════════════════════════════════════════════════════════════════════════

import { useTaskDetail } from "@/app/(dashboard)/tasks/_hooks/useTaskDetail";

/** SWR wrapper with fresh cache per test for useTaskDetail. */
function taskSwrWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );
}

describe("useTaskDetail", () => {
  const onChecklistChange = vi.fn();
  const task = makeTask();

  function setup(taskArg: Task | null = task, open = true) {
    return renderHook(() => useTaskDetail(taskArg, open, onChecklistChange), {
      wrapper: taskSwrWrapper,
    });
  }

  /** Setup with initial data and wait for SWR to settle. */
  async function setupWith(
    checklist: ChecklistItem[] = [],
    attachments: TaskAttachment[] = []
  ) {
    mockGetChecklist.mockResolvedValue(checklist);
    mockGetAttachments.mockResolvedValue(attachments);
    const rendered = setup();
    await waitFor(() =>
      expect(rendered.result.current.loadingChecklist).toBe(false)
    );
    return rendered;
  }

  // ── Initial fetch ─────────────────────────────────────────────────────

  it("fetches checklist and attachments when opened", async () => {
    const { result } = await setupWith(
      [makeChecklistItem()],
      [makeAttachment()]
    );

    expect(mockGetChecklist).toHaveBeenCalledWith("t1");
    expect(mockGetAttachments).toHaveBeenCalledWith("t1");
    expect(result.current.checklistItems).toHaveLength(1);
    expect(result.current.attachments).toHaveLength(1);
  });

  it("resets state when closed", async () => {
    mockGetChecklist.mockResolvedValue([makeChecklistItem()]);
    mockGetAttachments.mockResolvedValue([makeAttachment()]);

    const { result, rerender } = renderHook(
      ({ open }) => useTaskDetail(task, open, onChecklistChange),
      { initialProps: { open: true }, wrapper: taskSwrWrapper }
    );
    await waitFor(() => expect(result.current.checklistItems).toHaveLength(1));

    rerender({ open: false });
    // When closed, SWR key becomes null so data reverts to default
    expect(result.current.checklistItems).toHaveLength(0);
    expect(result.current.attachments).toHaveLength(0);
  });

  // ── addItem ───────────────────────────────────────────────────────────

  it("addItem creates item and appends to list", async () => {
    const newItem = makeChecklistItem({ id: "ci2", title: "New" });
    mockAddChecklistItem.mockResolvedValue(newItem);

    const { result } = await setupWith();

    act(() => result.current.setNewItemTitle("New"));

    await act(() => result.current.addItem());

    expect(mockAddChecklistItem).toHaveBeenCalledWith("t1", "New");
    expect(result.current.checklistItems).toHaveLength(1);
    expect(result.current.checklistItems[0].title).toBe("New");
    expect(result.current.newItemTitle).toBe("");
    expect(onChecklistChange).toHaveBeenCalled();
  });

  it("addItem skips when title is empty", async () => {
    const { result } = await setupWith();

    await act(() => result.current.addItem());

    expect(mockAddChecklistItem).not.toHaveBeenCalled();
  });

  // ── toggleItem ────────────────────────────────────────────────────────

  it("toggleItem optimistically updates and calls API", async () => {
    const item = makeChecklistItem({ is_done: false });
    mockToggleChecklistItem.mockResolvedValue(undefined);

    const { result } = await setupWith([item]);

    await act(() => result.current.toggleItem(item));

    expect(result.current.checklistItems[0].is_done).toBe(true);
    expect(mockToggleChecklistItem).toHaveBeenCalledWith("t1", "ci1", true);
    expect(onChecklistChange).toHaveBeenCalled();
  });

  it("toggleItem rolls back on failure", async () => {
    const item = makeChecklistItem({ is_done: false });
    mockToggleChecklistItem.mockRejectedValue(new Error("fail"));

    const { result } = await setupWith([item]);

    await act(() => result.current.toggleItem(item));

    // Rolled back to original
    expect(result.current.checklistItems[0].is_done).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  // ── deleteItem ────────────────────────────────────────────────────────

  it("deleteItem removes item optimistically", async () => {
    const item = makeChecklistItem();
    mockRemoveChecklistItem.mockResolvedValue(undefined);

    const { result } = await setupWith([item]);
    expect(result.current.checklistItems).toHaveLength(1);

    await act(() => result.current.deleteItem(item));

    expect(result.current.checklistItems).toHaveLength(0);
    expect(mockRemoveChecklistItem).toHaveBeenCalledWith("t1", "ci1");
    expect(onChecklistChange).toHaveBeenCalled();
  });

  it("deleteItem refetches on failure", async () => {
    const item = makeChecklistItem();
    mockGetChecklist.mockResolvedValue([item]);
    mockGetAttachments.mockResolvedValue([]);
    mockRemoveChecklistItem.mockRejectedValue(new Error("fail"));

    const { result } = setup();
    await waitFor(() => expect(result.current.checklistItems).toHaveLength(1));

    await act(() => result.current.deleteItem(item));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    // SWR revalidation re-fetches checklist
    await waitFor(() => expect(mockGetChecklist).toHaveBeenCalledTimes(2));
  });

  // ── handleDragEnd ─────────────────────────────────────────────────────

  it("handleDragEnd reorders items and calls API", async () => {
    const items = [
      makeChecklistItem({ id: "ci1", position: 0 }),
      makeChecklistItem({ id: "ci2", position: 1, title: "Item 2" }),
    ];
    mockReorderChecklist.mockResolvedValue(undefined);

    const { result } = await setupWith(items);

    const event = {
      active: { id: "ci1" },
      over: { id: "ci2" },
    } as unknown as Parameters<typeof result.current.handleDragEnd>[0];
    await act(() => result.current.handleDragEnd(event));

    expect(result.current.checklistItems[0].id).toBe("ci2");
    expect(result.current.checklistItems[1].id).toBe("ci1");
    expect(mockReorderChecklist).toHaveBeenCalledWith("t1", ["ci2", "ci1"]);
  });

  it("handleDragEnd does nothing when dropped on same position", async () => {
    const { result } = await setupWith([makeChecklistItem()]);

    const event = {
      active: { id: "ci1" },
      over: { id: "ci1" },
    } as unknown as Parameters<typeof result.current.handleDragEnd>[0];
    await act(() => result.current.handleDragEnd(event));

    expect(mockReorderChecklist).not.toHaveBeenCalled();
  });

  // ── handleUpload ──────────────────────────────────────────────────────

  it("handleUpload uploads file and prepends attachment", async () => {
    mockUploadFile.mockResolvedValue({
      url: "https://cdn/new.pdf",
      fileName: "new.pdf",
    });
    const newAtt = makeAttachment({ id: "a2", file_name: "new.pdf" });
    mockAddAttachment.mockResolvedValue(newAtt);

    const { result } = await setupWith();

    const file = new File(["data"], "new.pdf");
    await act(() => result.current.handleUpload(file));

    expect(mockUploadFile).toHaveBeenCalledWith(file);
    expect(mockAddAttachment).toHaveBeenCalledWith("t1", {
      fileUrl: "https://cdn/new.pdf",
      fileName: "new.pdf",
      fileSize: file.size,
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.uploading).toBe(false);
  });

  it("handleUpload shows error toast on failure", async () => {
    mockUploadFile.mockRejectedValue(new Error("fail"));

    const { result } = await setupWith();

    await act(() => result.current.handleUpload(new File([""], "f.pdf")));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(result.current.uploading).toBe(false);
  });

  // ── handleDownload ────────────────────────────────────────────────────

  it("handleDownload calls downloadFile with correct args", async () => {
    mockDownloadFile.mockResolvedValue(undefined);

    const { result } = await setupWith();

    const att = makeAttachment();
    await act(() => result.current.handleDownload(att));

    expect(mockDownloadFile).toHaveBeenCalledWith(
      "https://cdn/file.pdf",
      "file.pdf"
    );
  });

  it("handleDownload shows error toast on failure", async () => {
    mockDownloadFile.mockRejectedValue(new Error("fail"));

    const { result } = await setupWith();

    await act(() => result.current.handleDownload(makeAttachment()));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  // ── deleteAttachment ──────────────────────────────────────────────────

  it("deleteAttachment removes optimistically and calls API", async () => {
    const att = makeAttachment();
    mockRemoveAttachment.mockResolvedValue(undefined);

    const { result } = await setupWith([], [att]);
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));

    await act(() => result.current.deleteAttachment(att));

    expect(result.current.attachments).toHaveLength(0);
    expect(mockRemoveAttachment).toHaveBeenCalledWith("t1", "a1");
  });

  it("deleteAttachment refetches on failure", async () => {
    const att = makeAttachment();
    mockGetChecklist.mockResolvedValue([]);
    mockGetAttachments.mockResolvedValue([att]);
    mockRemoveAttachment.mockRejectedValue(new Error("fail"));

    const { result } = setup();
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));

    await act(() => result.current.deleteAttachment(att));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    // SWR revalidation re-fetches attachments
    await waitFor(() => expect(mockGetAttachments).toHaveBeenCalledTimes(2));
  });
});
