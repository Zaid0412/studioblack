import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  createProjectSchema,
  updateProjectSchema,
  patchNotificationsSchema,
  deleteNotificationsSchema,
  createProjectAttachmentSchema,
  updateAttachmentStatusSchema,
  createTaskAttachmentSchema,
  submitReviewSchema,
  createPinSchema,
  updatePinSchema,
  createApprovalSchema,
  createCommentSchema,
  createPhaseTaskSchema,
  updatePhaseTaskSchema,
  submitTaskReviewSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
  reorderChecklistSchema,
  createElementSchema,
  updateElementSchema,
  listElementsQuerySchema,
  ALLOWED_UNITS,
  submitQuoteSchema,
  awardRfqSingleSchema,
  awardRfqSplitSchema,
  parseBody,
  parseRequest,
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_CATEGORIES,
  PROJECT_STATUSES,
  PROJECT_CATEGORIES,
  REVIEW_STATUSES,
  ATTACHMENT_REVIEW_STATUSES,
  PHASE_TASK_STATUSES,
  APPROVAL_DECISIONS,
} from "@/lib/validations";

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function expectPass<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = parseBody(schema, data);
  expect(result.success).toBe(true);
  return (result as { success: true; data: z.infer<T> }).data;
}

function expectFail(schema: z.ZodType, data: unknown): string {
  const result = parseBody(schema, data);
  expect(result.success).toBe(false);
  return (result as { success: false; error: string }).error;
}

// ── createTaskSchema ─────────────────────────────────────────────────────────

describe("createTaskSchema", () => {
  it("accepts minimal valid input", () => {
    const data = expectPass(createTaskSchema, { title: "Buy paint" });
    expect(data).toMatchObject({ title: "Buy paint" });
  });

  it("accepts all optional fields", () => {
    const data = expectPass(createTaskSchema, {
      title: "Buy paint",
      description: "Red paint for walls",
      projectId: VALID_UUID,
      phaseId: VALID_UUID,
      priority: "high",
      category: "design",
      assignedTo: VALID_UUID,
      dueDate: "2026-05-01",
    });
    expect(data).toMatchObject({ title: "Buy paint", priority: "high" });
  });

  it("trims title whitespace", () => {
    const data = expectPass(createTaskSchema, { title: "  padded  " });
    expect(data.title).toBe("padded");
  });

  it("rejects empty title", () => {
    expectFail(createTaskSchema, { title: "" });
  });

  it("rejects whitespace-only title", () => {
    expectFail(createTaskSchema, { title: "   " });
  });

  it("rejects missing title", () => {
    expectFail(createTaskSchema, {});
  });

  it("rejects invalid priority", () => {
    expectFail(createTaskSchema, { title: "x", priority: "critical" });
  });

  it("rejects invalid category", () => {
    expectFail(createTaskSchema, { title: "x", category: "unknown" });
  });

  it("rejects invalid UUID for projectId", () => {
    expectFail(createTaskSchema, { title: "x", projectId: "not-a-uuid" });
  });

  it("allows null dueDate", () => {
    const data = expectPass(createTaskSchema, { title: "x", dueDate: null });
    expect(data.dueDate).toBeNull();
  });
});

// ── updateTaskSchema ─────────────────────────────────────────────────────────

describe("updateTaskSchema", () => {
  it("accepts empty object (all optional)", () => {
    expectPass(updateTaskSchema, {});
  });

  it("accepts all valid fields", () => {
    expectPass(updateTaskSchema, {
      title: "Updated",
      status: "completed",
      priority: "urgent",
      category: "review",
      assignedTo: VALID_UUID,
      projectId: VALID_UUID,
      phaseId: VALID_UUID,
      dueDate: "2026-06-01",
      reminderAt: "2026-05-30",
    });
  });

  it("rejects invalid status", () => {
    expectFail(updateTaskSchema, { status: "done" });
  });

  it("allows nullable assignedTo", () => {
    const data = expectPass(updateTaskSchema, { assignedTo: null });
    expect(data.assignedTo).toBeNull();
  });

  it("rejects whitespace-only title", () => {
    expectFail(updateTaskSchema, { title: "   " });
  });

  it("validates all status values", () => {
    for (const status of TASK_STATUSES) {
      expectPass(updateTaskSchema, { status });
    }
  });

  it("validates all priority values", () => {
    for (const priority of TASK_PRIORITIES) {
      expectPass(updateTaskSchema, { priority });
    }
  });

  it("validates all category values", () => {
    for (const category of TASK_CATEGORIES) {
      expectPass(updateTaskSchema, { category });
    }
  });
});

// ── createProjectSchema ──────────────────────────────────────────────────────

describe("createProjectSchema", () => {
  it("accepts minimal valid input", () => {
    const data = expectPass(createProjectSchema, {
      name: "Villa Renovation",
      category: "residential",
    });
    expect(data).toMatchObject({
      name: "Villa Renovation",
      category: "residential",
    });
  });

  it("accepts all optional fields", () => {
    expectPass(createProjectSchema, {
      name: "Office Redesign",
      category: "commercial",
      clientName: "Acme Corp",
      clientEmail: "client@acme.com",
      deadline: "2026-12-31",
      scope: "Full floor redesign",
      areaSqft: 5000,
      estimationInr: 1500000,
      address: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      phases: ["phase1", "phase2"],
      architectIds: [VALID_UUID],
    });
  });

  it("rejects missing name", () => {
    expectFail(createProjectSchema, { category: "residential" });
  });

  it("rejects missing category", () => {
    expectFail(createProjectSchema, { name: "Test" });
  });

  it("rejects invalid category", () => {
    expectFail(createProjectSchema, { name: "Test", category: "industrial" });
  });

  it("rejects invalid clientEmail", () => {
    expectFail(createProjectSchema, {
      name: "Test",
      category: "residential",
      clientEmail: "not-an-email",
    });
  });

  it("allows null clientEmail", () => {
    const data = expectPass(createProjectSchema, {
      name: "Test",
      category: "residential",
      clientEmail: null,
    });
    expect(data.clientEmail).toBeNull();
  });

  it("validates all category values", () => {
    for (const category of PROJECT_CATEGORIES) {
      expectPass(createProjectSchema, { name: "Test", category });
    }
  });

  it("rejects empty architectIds entries", () => {
    expectFail(createProjectSchema, {
      name: "Test",
      category: "residential",
      architectIds: [""],
    });
  });
});

// ── updateProjectSchema ──────────────────────────────────────────────────────

describe("updateProjectSchema", () => {
  it("accepts empty object", () => {
    expectPass(updateProjectSchema, {});
  });

  it("rejects invalid status", () => {
    expectFail(updateProjectSchema, { status: "cancelled" });
  });

  it("validates all status values", () => {
    for (const status of PROJECT_STATUSES) {
      expectPass(updateProjectSchema, { status });
    }
  });

  it("allows nullable fields", () => {
    const data = expectPass(updateProjectSchema, {
      clientName: null,
      clientEmail: null,
      deadline: null,
      scope: null,
      areaSqft: null,
      estimationInr: null,
      address: null,
      city: null,
      state: null,
    });
    expect(data.clientName).toBeNull();
  });
});

// ── patchNotificationsSchema ─────────────────────────────────────────────────

describe("patchNotificationsSchema", () => {
  it("accepts markAllRead", () => {
    expectPass(patchNotificationsSchema, { markAllRead: true });
  });

  it("accepts ids array", () => {
    expectPass(patchNotificationsSchema, { ids: [VALID_UUID] });
  });

  it("accepts empty object", () => {
    expectPass(patchNotificationsSchema, {});
  });

  it("rejects invalid UUID in ids", () => {
    expectFail(patchNotificationsSchema, { ids: ["bad-id"] });
  });
});

// ── deleteNotificationsSchema ────────────────────────────────────────────────

describe("deleteNotificationsSchema", () => {
  it("accepts valid id", () => {
    expectPass(deleteNotificationsSchema, { id: VALID_UUID });
  });

  it("accepts empty object", () => {
    expectPass(deleteNotificationsSchema, {});
  });

  it("rejects invalid id", () => {
    expectFail(deleteNotificationsSchema, { id: "not-uuid" });
  });
});

// ── createProjectAttachmentSchema ────────────────────────────────────────────

describe("createProjectAttachmentSchema", () => {
  it("accepts minimal valid input", () => {
    expectPass(createProjectAttachmentSchema, {
      fileUrl: "https://example.com/file.pdf",
      fileName: "floor-plan.pdf",
    });
  });

  it("accepts all optional fields", () => {
    expectPass(createProjectAttachmentSchema, {
      fileUrl: "https://example.com/file.pdf",
      fileName: "floor-plan.pdf",
      description: "Main floor layout",
      phaseId: VALID_UUID,
      taskId: VALID_UUID,
      versionGroup: VALID_UUID,
    });
  });

  it("rejects invalid URL", () => {
    expectFail(createProjectAttachmentSchema, {
      fileUrl: "not-a-url",
      fileName: "test.pdf",
    });
  });

  it("rejects empty fileName", () => {
    expectFail(createProjectAttachmentSchema, {
      fileUrl: "https://example.com/file.pdf",
      fileName: "",
    });
  });

  it("rejects description over 2000 chars", () => {
    expectFail(createProjectAttachmentSchema, {
      fileUrl: "https://example.com/file.pdf",
      fileName: "test.pdf",
      description: "a".repeat(2001),
    });
  });

  it("accepts description at exactly 2000 chars", () => {
    expectPass(createProjectAttachmentSchema, {
      fileUrl: "https://example.com/file.pdf",
      fileName: "test.pdf",
      description: "a".repeat(2000),
    });
  });
});

// ── updateAttachmentStatusSchema ─────────────────────────────────────────────

describe("updateAttachmentStatusSchema", () => {
  it("validates all review statuses", () => {
    for (const reviewStatus of REVIEW_STATUSES) {
      expectPass(updateAttachmentStatusSchema, { reviewStatus });
    }
  });

  it("rejects missing reviewStatus", () => {
    expectFail(updateAttachmentStatusSchema, {});
  });

  it("rejects invalid reviewStatus", () => {
    expectFail(updateAttachmentStatusSchema, { reviewStatus: "maybe" });
  });
});

// ── createTaskAttachmentSchema ───────────────────────────────────────────────

describe("createTaskAttachmentSchema", () => {
  it("accepts minimal valid input", () => {
    expectPass(createTaskAttachmentSchema, {
      fileUrl: "https://example.com/doc.pdf",
      fileName: "doc.pdf",
    });
  });

  it("accepts optional fileSize", () => {
    expectPass(createTaskAttachmentSchema, {
      fileUrl: "https://example.com/doc.pdf",
      fileName: "doc.pdf",
      fileSize: 1024,
    });
  });

  it("allows null fileSize", () => {
    const data = expectPass(createTaskAttachmentSchema, {
      fileUrl: "https://example.com/doc.pdf",
      fileName: "doc.pdf",
      fileSize: null,
    });
    expect(data.fileSize).toBeNull();
  });
});

// ── submitReviewSchema ───────────────────────────────────────────────────────

describe("submitReviewSchema", () => {
  it("accepts approved", () => {
    expectPass(submitReviewSchema, { status: "approved" });
  });

  it("accepts rejected with comment", () => {
    expectPass(submitReviewSchema, {
      status: "rejected",
      comment: "Needs revision",
    });
  });

  it("accepts optional annotatedFileUrl and annotationCount", () => {
    expectPass(submitReviewSchema, {
      status: "rejected",
      annotatedFileUrl: "https://example.com/annotated.pdf",
      annotationCount: 5,
    });
  });

  it("rejects invalid status", () => {
    expectFail(submitReviewSchema, { status: "pending" });
  });

  it("validates all attachment review statuses", () => {
    for (const status of ATTACHMENT_REVIEW_STATUSES) {
      expectPass(submitReviewSchema, { status });
    }
  });

  it("rejects negative annotationCount", () => {
    expectFail(submitReviewSchema, {
      status: "approved",
      annotationCount: -1,
    });
  });

  it("rejects non-integer annotationCount", () => {
    expectFail(submitReviewSchema, {
      status: "approved",
      annotationCount: 1.5,
    });
  });

  it("allows null annotatedFileUrl", () => {
    const data = expectPass(submitReviewSchema, {
      status: "approved",
      annotatedFileUrl: null,
    });
    expect(data.annotatedFileUrl).toBeNull();
  });
});

// ── createPinSchema ──────────────────────────────────────────────────────────

describe("createPinSchema", () => {
  it("accepts minimal valid input", () => {
    expectPass(createPinSchema, { content: "Fix this corner" });
  });

  it("accepts all optional fields", () => {
    expectPass(createPinSchema, {
      content: "Fix this corner",
      x_percent: 50.5,
      y_percent: 25.0,
      page: 3,
      request_changes: true,
      assign_as_task: {
        assigned_to: VALID_UUID,
        due_date: "2026-06-01",
      },
      parent_id: VALID_UUID,
    });
  });

  it("rejects empty content", () => {
    expectFail(createPinSchema, { content: "" });
  });

  it("rejects content over MAX_CONTENT_LENGTH", () => {
    expectFail(createPinSchema, { content: "a".repeat(5001) });
  });

  it("accepts content at exactly MAX_CONTENT_LENGTH", () => {
    expectPass(createPinSchema, { content: "a".repeat(5000) });
  });

  it("rejects x_percent over 100", () => {
    expectFail(createPinSchema, { content: "x", x_percent: 101 });
  });

  it("rejects negative y_percent", () => {
    expectFail(createPinSchema, { content: "x", y_percent: -1 });
  });

  it("rejects page 0", () => {
    expectFail(createPinSchema, { content: "x", page: 0 });
  });

  it("rejects non-integer page", () => {
    expectFail(createPinSchema, { content: "x", page: 1.5 });
  });

  it("allows null coordinates", () => {
    const data = expectPass(createPinSchema, {
      content: "x",
      x_percent: null,
      y_percent: null,
      page: null,
    });
    expect(data.x_percent).toBeNull();
  });

  // Shape annotation helpers — every shape carries its own style.
  // Frozen so a future Zod transform on `pinShapeSchema` can't mutate
  // the shared reference and bleed test state across cases.
  const STYLE = Object.freeze({
    color: "#dc2626",
    strokeWidth: 2,
    opacity: 1,
    fill: false,
  } as const);

  it("accepts a rectangle shape", () => {
    expectPass(createPinSchema, {
      content: "fix corner",
      shapes: [{ type: "rectangle", x: 10, y: 20, w: 30, h: 40, ...STYLE }],
    });
  });

  it("accepts a circle shape", () => {
    expectPass(createPinSchema, {
      content: "fix",
      shapes: [{ type: "circle", cx: 50, cy: 50, rx: 10, ry: 10, ...STYLE }],
    });
  });

  it("accepts a freehand shape", () => {
    expectPass(createPinSchema, {
      content: "fix",
      shapes: [
        {
          type: "freehand",
          points: [
            [10, 10],
            [20, 20],
            [30, 30],
          ],
          ...STYLE,
        },
      ],
    });
  });

  it("accepts multiple shapes with mixed types and styles", () => {
    expectPass(createPinSchema, {
      content: "look at these three things",
      shapes: [
        {
          type: "rectangle",
          x: 10,
          y: 10,
          w: 20,
          h: 20,
          color: "#dc2626",
          strokeWidth: 2,
          opacity: 1,
          fill: true,
        },
        {
          type: "circle",
          cx: 50,
          cy: 50,
          rx: 10,
          ry: 10,
          color: "#16a34a",
          strokeWidth: 4,
          opacity: 0.5,
          fill: false,
        },
        {
          type: "freehand",
          points: [
            [70, 70],
            [80, 80],
          ],
          color: "#0284c7",
          strokeWidth: 1,
          opacity: 1,
          fill: false,
        },
      ],
    });
  });

  it("rejects more than 20 shapes", () => {
    const shape = {
      type: "rectangle" as const,
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      ...STYLE,
    };
    expectFail(createPinSchema, {
      content: "too many",
      shapes: Array.from({ length: 21 }, () => shape),
    });
  });

  it("accepts exactly 20 shapes", () => {
    const shape = {
      type: "rectangle" as const,
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      ...STYLE,
    };
    expectPass(createPinSchema, {
      content: "max",
      shapes: Array.from({ length: 20 }, () => shape),
    });
  });

  it("rejects freehand with fewer than 2 points", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "freehand", points: [[10, 10]], ...STYLE }],
    });
  });

  it("rejects unknown shape type", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "triangle", x: 0, y: 0, w: 10, h: 10, ...STYLE }],
    });
  });

  it("rejects rectangle with out-of-range coords", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "rectangle", x: 10, y: 20, w: 30, h: 200, ...STYLE }],
    });
  });

  it("rejects rectangle with both dimensions zero", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "rectangle", x: 10, y: 20, w: 0, h: 0, ...STYLE }],
    });
  });

  it("accepts rectangle with only one non-zero dimension", () => {
    expectPass(createPinSchema, {
      content: "x",
      shapes: [{ type: "rectangle", x: 10, y: 20, w: 5, h: 0, ...STYLE }],
    });
    expectPass(createPinSchema, {
      content: "x",
      shapes: [{ type: "rectangle", x: 10, y: 20, w: 0, h: 5, ...STYLE }],
    });
  });

  it("rejects circle with both radii zero", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "circle", cx: 50, cy: 50, rx: 0, ry: 0, ...STYLE }],
    });
  });

  it("accepts circle with only one non-zero radius", () => {
    expectPass(createPinSchema, {
      content: "x",
      shapes: [{ type: "circle", cx: 50, cy: 50, rx: 5, ry: 0, ...STYLE }],
    });
    expectPass(createPinSchema, {
      content: "x",
      shapes: [{ type: "circle", cx: 50, cy: 50, rx: 0, ry: 5, ...STYLE }],
    });
  });

  it("rejects shape with malformed color", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          type: "rectangle",
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          color: "red",
          strokeWidth: 2,
          opacity: 1,
          fill: false,
        },
      ],
    });
  });

  it("rejects shape with stroke width 0", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          ...{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
          ...STYLE,
          strokeWidth: 0,
        },
      ],
    });
  });

  it("rejects shape with stroke width above 10", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          ...{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
          ...STYLE,
          strokeWidth: 11,
        },
      ],
    });
  });

  it("rejects shape with non-integer stroke width", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          ...{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
          ...STYLE,
          strokeWidth: 2.5,
        },
      ],
    });
  });

  it("rejects shape with opacity of 0", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          ...{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
          ...STYLE,
          opacity: 0,
        },
      ],
    });
  });

  it("rejects shape with opacity above 1", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [
        {
          ...{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 },
          ...STYLE,
          opacity: 1.5,
        },
      ],
    });
  });

  it("rejects shape missing style fields", () => {
    expectFail(createPinSchema, {
      content: "x",
      shapes: [{ type: "rectangle", x: 0, y: 0, w: 10, h: 10 }],
    });
  });
});

// ── updatePinSchema ──────────────────────────────────────────────────────────

describe("updatePinSchema", () => {
  it("accepts empty object", () => {
    expectPass(updatePinSchema, {});
  });

  it("accepts resolved flag", () => {
    expectPass(updatePinSchema, { resolved: true });
  });

  it("accepts content update", () => {
    expectPass(updatePinSchema, { content: "Updated note" });
  });

  it("accepts position update", () => {
    expectPass(updatePinSchema, { x_percent: 10, y_percent: 20, page: 1 });
  });

  it("rejects content over MAX_CONTENT_LENGTH", () => {
    expectFail(updatePinSchema, { content: "a".repeat(5001) });
  });
});

// ── createApprovalSchema ─────────────────────────────────────────────────────

describe("createApprovalSchema", () => {
  it("accepts approved decision", () => {
    expectPass(createApprovalSchema, { decision: "approved" });
  });

  it("accepts changes_requested with comment", () => {
    expectPass(createApprovalSchema, {
      decision: "changes_requested",
      comment: "Needs more detail",
      phaseId: VALID_UUID,
    });
  });

  it("rejects missing decision", () => {
    expectFail(createApprovalSchema, {});
  });

  it("rejects invalid decision", () => {
    expectFail(createApprovalSchema, { decision: "rejected" });
  });

  it("validates all approval decisions", () => {
    for (const decision of APPROVAL_DECISIONS) {
      expectPass(createApprovalSchema, { decision });
    }
  });
});

// ── createCommentSchema ──────────────────────────────────────────────────────

describe("createCommentSchema", () => {
  it("accepts minimal valid input", () => {
    expectPass(createCommentSchema, { content: "Looks good" });
  });

  it("rejects empty content", () => {
    expectFail(createCommentSchema, { content: "" });
  });

  it("rejects whitespace-only content", () => {
    expectFail(createCommentSchema, { content: "   " });
  });

  it("rejects content over MAX_CONTENT_LENGTH", () => {
    expectFail(createCommentSchema, { content: "a".repeat(5001) });
  });

  it("accepts optional phaseId and taskId", () => {
    expectPass(createCommentSchema, {
      content: "Note",
      phaseId: VALID_UUID,
      taskId: VALID_UUID,
    });
  });
});

// ── createPhaseTaskSchema ────────────────────────────────────────────────────

describe("createPhaseTaskSchema", () => {
  it("accepts minimal valid input", () => {
    expectPass(createPhaseTaskSchema, {
      phaseId: VALID_UUID,
      title: "Review layout",
    });
  });

  it("rejects missing phaseId", () => {
    expectFail(createPhaseTaskSchema, { title: "Review layout" });
  });

  it("rejects invalid phaseId", () => {
    expectFail(createPhaseTaskSchema, {
      phaseId: "bad",
      title: "Review layout",
    });
  });

  it("rejects missing title", () => {
    expectFail(createPhaseTaskSchema, { phaseId: VALID_UUID });
  });
});

// ── updatePhaseTaskSchema ────────────────────────────────────────────────────

describe("updatePhaseTaskSchema", () => {
  it("accepts minimal input (taskId required)", () => {
    expectPass(updatePhaseTaskSchema, { taskId: VALID_UUID });
  });

  it("accepts all optional fields", () => {
    expectPass(updatePhaseTaskSchema, {
      taskId: VALID_UUID,
      title: "Updated",
      description: "New desc",
      status: "completed",
      assignedTo: VALID_UUID,
      dueDate: "2026-07-01",
      requiresClientReview: true,
    });
  });

  it("rejects missing taskId", () => {
    expectFail(updatePhaseTaskSchema, { title: "Updated" });
  });

  it("rejects invalid status", () => {
    expectFail(updatePhaseTaskSchema, {
      taskId: VALID_UUID,
      status: "done",
    });
  });

  it("validates all phase task statuses", () => {
    for (const status of PHASE_TASK_STATUSES) {
      expectPass(updatePhaseTaskSchema, { taskId: VALID_UUID, status });
    }
  });

  it("allows nullable assignedTo", () => {
    const data = expectPass(updatePhaseTaskSchema, {
      taskId: VALID_UUID,
      assignedTo: null,
    });
    expect(data.assignedTo).toBeNull();
  });
});

// ── submitTaskReviewSchema ───────────────────────────────────────────────────

describe("submitTaskReviewSchema", () => {
  it("accepts approved action", () => {
    expectPass(submitTaskReviewSchema, { action: "approved" });
  });

  it("accepts changes_requested with comment", () => {
    expectPass(submitTaskReviewSchema, {
      action: "changes_requested",
      comment: "Fix the measurements",
    });
  });

  it("rejects invalid action", () => {
    expectFail(submitTaskReviewSchema, { action: "rejected" });
  });

  it("rejects missing action", () => {
    expectFail(submitTaskReviewSchema, {});
  });
});

// ── createChecklistItemSchema ────────────────────────────────────────────────

describe("createChecklistItemSchema", () => {
  it("accepts valid title", () => {
    expectPass(createChecklistItemSchema, { title: "Check dimensions" });
  });

  it("trims whitespace", () => {
    const data = expectPass(createChecklistItemSchema, {
      title: "  trimmed  ",
    });
    expect(data.title).toBe("trimmed");
  });

  it("rejects empty title", () => {
    expectFail(createChecklistItemSchema, { title: "" });
  });

  it("rejects whitespace-only title", () => {
    expectFail(createChecklistItemSchema, { title: "   " });
  });
});

// ── updateChecklistItemSchema ────────────────────────────────────────────────

describe("updateChecklistItemSchema", () => {
  it("accepts empty object", () => {
    expectPass(updateChecklistItemSchema, {});
  });

  it("accepts title update", () => {
    expectPass(updateChecklistItemSchema, { title: "Updated" });
  });

  it("accepts is_done toggle", () => {
    expectPass(updateChecklistItemSchema, { is_done: true });
  });

  it("accepts position update", () => {
    expectPass(updateChecklistItemSchema, { position: 0 });
  });

  it("rejects negative position", () => {
    expectFail(updateChecklistItemSchema, { position: -1 });
  });

  it("rejects non-integer position", () => {
    expectFail(updateChecklistItemSchema, { position: 1.5 });
  });
});

// ── reorderChecklistSchema ───────────────────────────────────────────────────

describe("reorderChecklistSchema", () => {
  it("accepts valid ordered IDs", () => {
    expectPass(reorderChecklistSchema, { orderedIds: [VALID_UUID] });
  });

  it("rejects empty array", () => {
    expectFail(reorderChecklistSchema, { orderedIds: [] });
  });

  it("rejects invalid UUIDs", () => {
    expectFail(reorderChecklistSchema, { orderedIds: ["bad"] });
  });

  it("rejects missing orderedIds", () => {
    expectFail(reorderChecklistSchema, {});
  });
});

// ── parseBody ────────────────────────────────────────────────────────────────

describe("parseBody", () => {
  it("returns success with parsed data", () => {
    const result = parseBody(createChecklistItemSchema, { title: "Test" });
    expect(result).toEqual({ success: true, data: { title: "Test" } });
  });

  it("returns error with field path", () => {
    const result = parseBody(createTaskSchema, { title: "x", priority: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("priority");
    }
  });

  it("returns error without path for root-level issue", () => {
    const result = parseBody(createChecklistItemSchema, "not-an-object");
    expect(result.success).toBe(false);
  });

  it("strips unknown fields from output", () => {
    const result = parseBody(createTaskSchema, {
      title: "Test",
      hackedField: "injection",
      __proto__: "attack",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("hackedField");
      expect(result.data).not.toHaveProperty("__proto__");
    }
  });
});

// ── parseRequest ─────────────────────────────────────────────────────────────

describe("parseRequest", () => {
  function mockRequest(body: unknown, valid = true): Request {
    if (!valid) {
      return {
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Request;
    }
    return {
      json: () => Promise.resolve(body),
    } as unknown as Request;
  }

  it("parses valid JSON body", async () => {
    const result = await parseRequest(
      mockRequest({ title: "Test" }),
      createChecklistItemSchema
    );
    expect(result).toEqual({ success: true, data: { title: "Test" } });
  });

  it("returns error for malformed JSON", async () => {
    const result = await parseRequest(
      mockRequest(null, false),
      createChecklistItemSchema
    );
    expect(result).toEqual({
      success: false,
      error: "Invalid JSON body",
    });
  });

  it("returns validation error for invalid data", async () => {
    const result = await parseRequest(
      mockRequest({ title: "" }),
      createChecklistItemSchema
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});

// ── createElementSchema ──────────────────────────────────────────────────────

describe("createElementSchema", () => {
  it("accepts minimal valid input", () => {
    const data = expectPass(createElementSchema, {
      code: "WAL-PNT-001",
      name: "Paint",
      unit: "m2",
      unitCost: 120,
    });
    expect(data).toMatchObject({
      code: "WAL-PNT-001",
      name: "Paint",
      unit: "m2",
      unitCost: 120,
      currency: "USD",
    });
  });

  it("accepts all optional fields", () => {
    const data = expectPass(createElementSchema, {
      code: "X",
      name: "X",
      description: "desc",
      categoryId: VALID_UUID,
      unit: "m3",
      unitCost: 10,
      currency: "INR",
      materialCost: 5,
      labourCost: 3,
      overheadPct: 10,
      marginPct: 15,
      specReference: "spec",
      drawingRef: "draw",
      tags: ["a", "b"],
      attributes: [
        { attribute_key: "Finish", attribute_value: "Matte", sort_order: 0 },
      ],
    });
    expect(data.attributes).toHaveLength(1);
    expect(data.tags).toEqual(["a", "b"]);
  });

  it("rejects empty code", () => {
    expectFail(createElementSchema, {
      code: "",
      name: "X",
      unit: "m2",
      unitCost: 10,
    });
  });

  it("rejects unit not in ALLOWED_UNITS", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "bananas",
      unitCost: 10,
    });
  });

  it("rejects negative unitCost", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: -1,
    });
  });

  it("rejects overheadPct above 100", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      overheadPct: 101,
    });
  });

  it("trims name and code whitespace", () => {
    const data = expectPass(createElementSchema, {
      code: "  CODE  ",
      name: "  Name  ",
      unit: "m2",
      unitCost: 10,
    });
    expect(data.code).toBe("CODE");
    expect(data.name).toBe("Name");
  });

  it("rejects attribute with empty key", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      attributes: [{ attribute_key: "", attribute_value: "v" }],
    });
  });

  it("rejects currency of wrong length", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      currency: "US",
    });
  });

  it("accepts optional clientRate and budgetRate", () => {
    const data = expectPass(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      clientRate: 250,
      budgetRate: 8.5,
    });
    expect(data.clientRate).toBe(250);
    expect(data.budgetRate).toBe(8.5);
  });

  it("accepts null for clientRate and budgetRate (clear via PATCH)", () => {
    const data = expectPass(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      clientRate: null,
      budgetRate: null,
    });
    expect(data.clientRate).toBeNull();
    expect(data.budgetRate).toBeNull();
  });

  it("rejects negative clientRate / budgetRate", () => {
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      clientRate: -1,
    });
    expectFail(createElementSchema, {
      code: "X",
      name: "X",
      unit: "m2",
      unitCost: 10,
      budgetRate: -1,
    });
  });
});

// ── updateElementSchema ──────────────────────────────────────────────────────

describe("updateElementSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expectPass(updateElementSchema, {});
  });

  it("accepts isActive flag", () => {
    const data = expectPass(updateElementSchema, { isActive: false });
    expect(data.isActive).toBe(false);
  });

  it("accepts partial update", () => {
    const data = expectPass(updateElementSchema, {
      name: "New Name",
      unitCost: 200,
    });
    expect(data.name).toBe("New Name");
    expect(data.unitCost).toBe(200);
  });

  it("rejects negative materialCost", () => {
    expectFail(updateElementSchema, { materialCost: -5 });
  });
});

// ── listElementsQuerySchema ──────────────────────────────────────────────────

describe("listElementsQuerySchema", () => {
  it("defaults page=1 and limit=25", () => {
    const data = expectPass(listElementsQuerySchema, {});
    expect(data.page).toBe(1);
    expect(data.limit).toBe(25);
  });

  it("coerces numeric strings to numbers (URL params)", () => {
    const data = expectPass(listElementsQuerySchema, {
      page: "3",
      limit: "25",
    });
    expect(data.page).toBe(3);
    expect(data.limit).toBe(25);
  });

  it("coerces isActive string 'true' to boolean", () => {
    const data = expectPass(listElementsQuerySchema, { isActive: "true" });
    expect(data.isActive).toBe(true);
  });

  it("coerces isActive string 'false' to boolean", () => {
    const data = expectPass(listElementsQuerySchema, { isActive: "false" });
    expect(data.isActive).toBe(false);
  });

  it("accepts tags as array", () => {
    const data = expectPass(listElementsQuerySchema, {
      tags: ["a", "b"],
    });
    expect(data.tags).toEqual(["a", "b"]);
  });

  it("rejects limit above 200", () => {
    expectFail(listElementsQuerySchema, { limit: 500 });
  });

  it("rejects invalid unit", () => {
    expectFail(listElementsQuerySchema, { unit: "bananas" });
  });

  it("rejects non-UUID categoryId", () => {
    expectFail(listElementsQuerySchema, { categoryId: "not-a-uuid" });
  });
});

// ── Project Documents schemas ────────────────────────────────────────────────

describe("createDocumentSectionSchema", () => {
  it("accepts a normal name + icon", async () => {
    const { createDocumentSectionSchema } = await import("@/lib/validations");
    expectPass(createDocumentSectionSchema, {
      name: "Minutes of Meeting",
      icon: "Folder",
    });
  });

  it("accepts a name without an icon (defaults applied at the route)", async () => {
    const { createDocumentSectionSchema } = await import("@/lib/validations");
    expectPass(createDocumentSectionSchema, { name: "MoM" });
  });

  it("rejects empty / whitespace names", async () => {
    const { createDocumentSectionSchema } = await import("@/lib/validations");
    expectFail(createDocumentSectionSchema, { name: "" });
    expectFail(createDocumentSectionSchema, { name: "   " });
  });

  it("rejects icons that don't look like lucide names", async () => {
    const { createDocumentSectionSchema } = await import("@/lib/validations");
    expectFail(createDocumentSectionSchema, {
      name: "x",
      icon: "Folder Open",
    });
    expectFail(createDocumentSectionSchema, { name: "x", icon: "WAY/TOO_BAD" });
    expectFail(createDocumentSectionSchema, { name: "x", icon: "lowercase" });
    expectFail(createDocumentSectionSchema, { name: "x", icon: "file-text" });
  });
});

describe("createDocumentSchema", () => {
  it("accepts a typical upload payload", async () => {
    const { createDocumentSchema } = await import("@/lib/validations");
    expectPass(createDocumentSchema, {
      fileName: "report.pdf",
      fileSize: 12345,
      mimeType: "application/pdf",
      storagePath: "projects/abc/documents/foo.pdf",
    });
  });

  it("accepts an optional description", async () => {
    const { createDocumentSchema } = await import("@/lib/validations");
    expectPass(createDocumentSchema, {
      fileName: "report.pdf",
      fileSize: 12345,
      mimeType: "application/pdf",
      storagePath: "projects/abc/documents/foo.pdf",
      description: "Quarterly site walkthrough notes.",
    });
  });

  it("rejects files larger than the 50 MB cap", async () => {
    const { createDocumentSchema } = await import("@/lib/validations");
    const { MAX_UPLOAD_SIZE } = await import("@/lib/fileUtils");
    expectFail(createDocumentSchema, {
      fileName: "x.pdf",
      fileSize: MAX_UPLOAD_SIZE + 1,
      mimeType: "application/pdf",
      storagePath: "projects/abc/documents/x.pdf",
    });
  });

  it("rejects zero / negative sizes", async () => {
    const { createDocumentSchema } = await import("@/lib/validations");
    expectFail(createDocumentSchema, {
      fileName: "x.pdf",
      fileSize: 0,
      mimeType: "application/pdf",
      storagePath: "projects/abc/documents/x.pdf",
    });
  });
});

describe("updateDocumentSchema", () => {
  it("accepts a filename-only update", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectPass(updateDocumentSchema, { fileName: "new-name.pdf" });
  });

  it("accepts a description-only update (including null to clear)", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectPass(updateDocumentSchema, { description: "Updated notes." });
    expectPass(updateDocumentSchema, { description: null });
  });

  it("accepts a sectionId-only update with a UUID", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectPass(updateDocumentSchema, {
      sectionId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects an empty body — at least one field must be supplied", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectFail(updateDocumentSchema, {});
  });

  it("rejects a non-UUID sectionId", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectFail(updateDocumentSchema, { sectionId: "not-a-uuid" });
  });

  it("rejects an empty filename", async () => {
    const { updateDocumentSchema } = await import("@/lib/validations");
    expectFail(updateDocumentSchema, { fileName: "" });
  });
});

describe("document version schemas", () => {
  it("documentUploadUrlSchema accepts the basic shape", async () => {
    const { documentUploadUrlSchema } = await import("@/lib/validations");
    expectPass(documentUploadUrlSchema, {
      fileName: "rev2.pdf",
      fileSize: 12345,
    });
  });

  it("documentUploadUrlSchema rejects oversized fileSize", async () => {
    const { documentUploadUrlSchema } = await import("@/lib/validations");
    expectFail(documentUploadUrlSchema, {
      fileName: "rev2.pdf",
      fileSize: 10 ** 12,
    });
  });

  it("revertDocumentSchema requires a positive integer targetVersion", async () => {
    const { revertDocumentSchema } = await import("@/lib/validations");
    expectPass(revertDocumentSchema, { targetVersion: 1 });
    expectFail(revertDocumentSchema, { targetVersion: 0 });
    expectFail(revertDocumentSchema, { targetVersion: 1.5 });
    expectFail(revertDocumentSchema, { targetVersion: -1 });
    expectFail(revertDocumentSchema, {});
  });
});

// ── ALLOWED_UNITS constant ───────────────────────────────────────────────────

describe("ALLOWED_UNITS", () => {
  it("exposes all 15 canonical units", () => {
    expect(ALLOWED_UNITS).toEqual([
      "m2",
      "m3",
      "lm",
      "no",
      "item",
      "kg",
      "tonne",
      "ls",
      "set",
      "pair",
      "roll",
      "sheet",
      "bag",
      "box",
      "pallet",
    ]);
  });
});

describe("submitQuoteSchema (F10)", () => {
  it("accepts a minimal valid quote and defaults currency to USD", () => {
    const data = expectPass(submitQuoteSchema, {
      items: [{ rfqItemId: VALID_UUID, unitPrice: 50 }],
    });
    expect(data.currency).toBe("USD");
  });

  it("rejects empty items array", () => {
    expectFail(submitQuoteSchema, { items: [] });
  });

  it("rejects negative unit_price", () => {
    expectFail(submitQuoteSchema, {
      items: [{ rfqItemId: VALID_UUID, unitPrice: -1 }],
    });
  });

  it("rejects non-uuid rfqItemId", () => {
    expectFail(submitQuoteSchema, {
      items: [{ rfqItemId: "abc", unitPrice: 50 }],
    });
  });

  it("coerces string unit_price to number", () => {
    const data = expectPass(submitQuoteSchema, {
      items: [{ rfqItemId: VALID_UUID, unitPrice: "75.50" }],
    });
    expect(data.items[0].unitPrice).toBe(75.5);
  });
});

describe("awardRfqSingleSchema (F10)", () => {
  it("accepts a uuid", () => {
    expectPass(awardRfqSingleSchema, { quoteId: VALID_UUID });
  });

  it("rejects non-uuid", () => {
    expectFail(awardRfqSingleSchema, { quoteId: "abc" });
  });
});

describe("awardRfqSplitSchema (F10)", () => {
  it("accepts a list of (rfqItemId, quoteItemId) pairs", () => {
    expectPass(awardRfqSplitSchema, {
      awards: [
        {
          rfqItemId: VALID_UUID,
          quoteItemId: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });
  });

  it("rejects empty awards array", () => {
    expectFail(awardRfqSplitSchema, { awards: [] });
  });
});
