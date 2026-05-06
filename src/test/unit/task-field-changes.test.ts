import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` calls are hoisted to the top of the file, so any local var
// referenced inside the factory must be declared with `vi.hoisted` to be
// initialized before the factory runs.
const { logAuditSafe } = vi.hoisted(() => ({
  logAuditSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: vi.fn() }),
}));

vi.mock("@/lib/queries/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/audit")>(
    "@/lib/queries/audit"
  );
  return { ...actual, logAuditSafe };
});

import { logTaskFieldChanges } from "@/lib/queries/taskActivity";
import { AUDIT_ACTIONS } from "@/lib/queries/audit";

const baseTask = {
  status: "todo",
  priority: "medium",
  category: "general",
  assigned_to: "user-A",
  assigned_to_name: "Alice",
  due_date: null,
  project_id: null,
  project_name: null,
  phase_id: null,
  phase_name: null,
  title: "Original",
  description: "Body",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logTaskFieldChanges", () => {
  it("writes nothing when nothing changed", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: baseTask,
      after: baseTask,
    });
    expect(logAuditSafe).not.toHaveBeenCalled();
  });

  it("writes one event per changed field", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: baseTask,
      after: {
        ...baseTask,
        status: "in_progress",
        priority: "high",
      },
    });
    const actions = logAuditSafe.mock.calls.map((c) => c[0].action);
    expect(actions).toContain(AUDIT_ACTIONS.TASK_STATUS_CHANGED);
    expect(actions).toContain(AUDIT_ACTIONS.TASK_PRIORITY_CHANGED);
    expect(actions).toHaveLength(2);
  });

  it("includes from/to in metadata for primitive fields", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: baseTask,
      after: { ...baseTask, status: "completed" },
    });
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.TASK_STATUS_CHANGED,
        metadata: { from: "todo", to: "completed" },
      })
    );
  });

  it("attaches display names for assignee changes", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: baseTask,
      after: {
        ...baseTask,
        assigned_to: "user-B",
        assigned_to_name: "Bob",
      },
    });
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.TASK_ASSIGNEE_CHANGED,
        metadata: {
          from: "user-A",
          to: "user-B",
          from_name: "Alice",
          to_name: "Bob",
        },
      })
    );
  });

  it("elides description content (just records that it was edited)", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: baseTask,
      after: { ...baseTask, description: "completely new body" },
    });
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.TASK_DESCRIPTION_CHANGED,
        metadata: {},
      })
    );
  });

  it("treats null and undefined as equal (no spurious writes)", async () => {
    await logTaskFieldChanges({
      orgId: "org",
      actorId: "actor",
      taskId: "t1",
      before: { ...baseTask, due_date: null },
      after: { ...baseTask, due_date: undefined as unknown as null },
    });
    expect(logAuditSafe).not.toHaveBeenCalled();
  });
});
