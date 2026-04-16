import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Must unmock since setup.ts mocks it ──────────────────────────────────────

vi.unmock("@/lib/notifications");

import {
  createNotification,
  createNotificationsForTeam,
  notifyUserByEmail,
  notifyUserByEmailWithContext,
  notifyTeamByEmail,
  createNotificationForClient,
} from "@/lib/notifications";
import { mocks } from "../setup";

// Re-import mocked modules so we can inspect calls
const { sendNotificationEmail } = await import("@/lib/email");
const { logger } = await import("@/lib/logger");

// ── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createNotification ──────────────────────────────────────────────────────

describe("createNotification", () => {
  it("inserts a notification row with all fields", async () => {
    await createNotification({
      userId: "u1",
      type: "review",
      title: "Review requested",
      description: "Task X needs review",
      projectId: "p1",
      taskId: "t1",
    });

    expect(mocks.db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      ["u1", "review", "Review requested", "Task X needs review", "p1", "t1"]
    );
  });

  it("defaults description to empty string and IDs to null", async () => {
    await createNotification({
      userId: "u1",
      type: "upload",
      title: "File uploaded",
    });

    expect(mocks.db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      ["u1", "upload", "File uploaded", "", null, null]
    );
  });
});

// ── createNotificationsForTeam ──────────────────────────────────────────────

describe("createNotificationsForTeam", () => {
  it("inserts notifications for team members excluding the actor", async () => {
    await createNotificationsForTeam(
      "p1",
      "u-actor",
      "upload",
      "New file",
      "photo.png uploaded"
    );

    expect(mocks.db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      ["p1", "u-actor", "upload", "New file", "photo.png uploaded"]
    );
  });

  it("defaults description to empty string", async () => {
    await createNotificationsForTeam("p1", "u-actor", "upload", "New file");

    expect(mocks.db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      ["p1", "u-actor", "upload", "New file", ""]
    );
  });
});

// ── notifyUserByEmail ───────────────────────────────────────────────────────

describe("notifyUserByEmail", () => {
  it("queries the user email and sends notification", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ email: "user@test.com" }],
    });

    notifyUserByEmail("u1", "Subject", "<p>Body</p>");

    // Wait for the fire-and-forget promise chain
    await vi.waitFor(() => {
      expect(sendNotificationEmail).toHaveBeenCalledWith(
        "user@test.com",
        "Subject",
        "<p>Body</p>"
      );
    });
  });

  it("logs warning when no email found", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });

    notifyUserByEmail("u-missing", "Subject", "<p>Body</p>");

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "notifyUserByEmail: no email found",
        { userId: "u-missing" }
      );
    });
  });

  it("logs error when query fails", async () => {
    mocks.db.query.mockRejectedValueOnce(new Error("DB down"));

    notifyUserByEmail("u1", "Subject", "<p>Body</p>");

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "notifyUserByEmail: query failed",
        expect.objectContaining({ userId: "u1" })
      );
    });
  });
});

// ── notifyUserByEmailWithContext ─────────────────────────────────────────────

describe("notifyUserByEmailWithContext", () => {
  it("queries user + project and calls builder", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [
        { email: "user@test.com", name: "Alice", project_name: "My Project" },
      ],
    });

    const builder = vi.fn().mockReturnValue({
      subject: "Update",
      html: "<p>Update</p>",
    });

    notifyUserByEmailWithContext("u1", "p1", builder);

    await vi.waitFor(() => {
      expect(builder).toHaveBeenCalledWith({
        email: "user@test.com",
        name: "Alice",
        projectName: "My Project",
      });
      expect(sendNotificationEmail).toHaveBeenCalledWith(
        "user@test.com",
        "Update",
        "<p>Update</p>"
      );
    });
  });

  it("passes null projectName when projectId is null", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ email: "user@test.com", name: "Alice" }],
    });

    const builder = vi.fn().mockReturnValue({
      subject: "Hi",
      html: "<p>Hi</p>",
    });

    notifyUserByEmailWithContext("u1", null, builder);

    await vi.waitFor(() => {
      expect(builder).toHaveBeenCalledWith({
        email: "user@test.com",
        name: "Alice",
        projectName: null,
      });
    });
  });

  it("logs warning when no email found", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });
    const builder = vi.fn();

    notifyUserByEmailWithContext("u-missing", "p1", builder);

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "notifyUserByEmailWithContext: no email found",
        { userId: "u-missing", projectId: "p1" }
      );
    });
  });
});

// ── notifyTeamByEmail ───────────────────────────────────────────────────────

describe("notifyTeamByEmail", () => {
  it("queries team members and sends emails to each", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [
        { email: "a@test.com", name: "Alice", project_name: "Proj" },
        { email: "b@test.com", name: "Bob", project_name: "Proj" },
      ],
    });

    const builder = vi.fn((m: { name: string }) => ({
      subject: `Hi ${m.name}`,
      html: `<p>Hi ${m.name}</p>`,
    }));

    notifyTeamByEmail("p1", ["u-exclude"], builder);

    await vi.waitFor(() => {
      expect(builder).toHaveBeenCalledTimes(2);
      expect(sendNotificationEmail).toHaveBeenCalledTimes(2);
    });
  });

  it("builds correct exclude clause with multiple IDs", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });

    const builder = vi.fn().mockReturnValue({ subject: "", html: "" });

    notifyTeamByEmail("p1", ["u1", "u2"], builder);

    await vi.waitFor(() => {
      expect(mocks.db.query).toHaveBeenCalledWith(
        expect.stringContaining("NOT IN ($2, $3)"),
        ["p1", "u1", "u2"]
      );
    });
  });
});

// ── createNotificationForClient ─────────────────────────────────────────────

describe("createNotificationForClient", () => {
  it("creates notification for the client user", async () => {
    // First query: find client user ID
    mocks.db.query.mockResolvedValueOnce({ rows: [{ id: "client-1" }] });
    // Second query: insert notification
    mocks.db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await createNotificationForClient(
      "p1",
      "review_requested",
      "Review requested",
      "Task needs review"
    );

    // Second call should be the INSERT
    expect(mocks.db.query).toHaveBeenCalledTimes(2);
    expect(mocks.db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO notification"),
      [
        "client-1",
        "review_requested",
        "Review requested",
        "Task needs review",
        "p1",
        null,
      ]
    );
  });

  it("does nothing when no client user found", async () => {
    mocks.db.query.mockResolvedValueOnce({ rows: [] });

    await createNotificationForClient("p1", "upload", "New file");

    // Only the lookup query, no INSERT
    expect(mocks.db.query).toHaveBeenCalledTimes(1);
  });
});
