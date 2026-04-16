import { describe, it, expect } from "vitest";
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

function expectPass(schema: Parameters<typeof parseBody>[0], data: unknown) {
  const result = parseBody(schema, data);
  expect(result.success).toBe(true);
  return (result as { success: true; data: unknown }).data;
}

function expectFail(schema: Parameters<typeof parseBody>[0], data: unknown) {
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
