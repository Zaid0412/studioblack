import { describe, it, expect } from "vitest";
import { API } from "@/lib/api/routes";

describe("API route builders", () => {
  // ── Projects ────────────────────────────────────────────────────────────

  it("projects()", () => {
    expect(API.projects()).toBe("/api/projects");
  });

  it("project(id)", () => {
    expect(API.project("p1")).toBe("/api/projects/p1");
  });

  // ── Attachments ─────────────────────────────────────────────────────────

  it("attachments(pid)", () => {
    expect(API.attachments("p1")).toBe("/api/projects/p1/attachments");
  });

  it("attachment(pid, fid)", () => {
    expect(API.attachment("p1", "f1")).toBe("/api/projects/p1/attachments/f1");
  });

  it("attachmentReview(pid, fid)", () => {
    expect(API.attachmentReview("p1", "f1")).toBe(
      "/api/projects/p1/attachments/f1/review"
    );
  });

  it("attachmentFreeze(pid, fid)", () => {
    expect(API.attachmentFreeze("p1", "f1")).toBe(
      "/api/projects/p1/attachments/f1/freeze"
    );
  });

  it("attachmentUnfreeze(pid, fid)", () => {
    expect(API.attachmentUnfreeze("p1", "f1")).toBe(
      "/api/projects/p1/attachments/f1/unfreeze"
    );
  });

  it("attachmentSendToClient(pid, fid)", () => {
    expect(API.attachmentSendToClient("p1", "f1")).toBe(
      "/api/projects/p1/attachments/f1/send-to-client"
    );
  });

  it("attachmentPins(pid, fid)", () => {
    expect(API.attachmentPins("p1", "f1")).toBe(
      "/api/projects/p1/attachments/f1/pins"
    );
  });

  it("attachmentPin(pid, fid, pinId)", () => {
    expect(API.attachmentPin("p1", "f1", "pin1")).toBe(
      "/api/projects/p1/attachments/f1/pins/pin1"
    );
  });

  it("attachmentPinReplies(pid, fid, pinId)", () => {
    expect(API.attachmentPinReplies("p1", "f1", "pin1")).toBe(
      "/api/projects/p1/attachments/f1/pins/pin1/replies"
    );
  });

  // ── Versions ────────────────────────────────────────────────────────────

  it("versionHistory(pid, group)", () => {
    expect(API.versionHistory("p1", "g1")).toBe("/api/projects/p1/versions/g1");
  });

  // ── Comments / Approvals ──────────────────────────────────────────────

  it("comments(pid)", () => {
    expect(API.comments("p1")).toBe("/api/projects/p1/comments");
  });

  it("approvals(pid)", () => {
    expect(API.approvals("p1")).toBe("/api/projects/p1/approvals");
  });

  // ── Task Review ─────────────────────────────────────────────────────────

  it("taskReview(pid, tid)", () => {
    expect(API.taskReview("p1", "t1")).toBe("/api/projects/p1/tasks/t1/review");
  });

  it("tasksPendingReview(pid)", () => {
    expect(API.tasksPendingReview("p1")).toBe(
      "/api/projects/p1/tasks/pending-review"
    );
  });

  // ── Tasks ───────────────────────────────────────────────────────────────

  it("tasks()", () => {
    expect(API.tasks()).toBe("/api/tasks");
  });

  it("task(id)", () => {
    expect(API.task("t1")).toBe("/api/tasks/t1");
  });

  it("taskStar(id)", () => {
    expect(API.taskStar("t1")).toBe("/api/tasks/t1/star");
  });

  // ── Checklist ─────────────────────────────────────────────────────────

  it("taskChecklist(tid)", () => {
    expect(API.taskChecklist("t1")).toBe("/api/tasks/t1/checklist");
  });

  it("taskChecklistItem(tid, iid)", () => {
    expect(API.taskChecklistItem("t1", "i1")).toBe(
      "/api/tasks/t1/checklist/i1"
    );
  });

  it("taskChecklistReorder(tid)", () => {
    expect(API.taskChecklistReorder("t1")).toBe(
      "/api/tasks/t1/checklist/reorder"
    );
  });

  // ── Task Attachments ──────────────────────────────────────────────────

  it("taskAttachments(tid)", () => {
    expect(API.taskAttachments("t1")).toBe("/api/tasks/t1/attachments");
  });

  it("taskAttachment(tid, aid)", () => {
    expect(API.taskAttachment("t1", "a1")).toBe("/api/tasks/t1/attachments/a1");
  });

  // ── Notifications ─────────────────────────────────────────────────────

  it("notifications()", () => {
    expect(API.notifications()).toBe("/api/notifications");
  });

  // ── Upload & Files ────────────────────────────────────────────────────

  it("upload()", () => {
    expect(API.upload()).toBe("/api/upload");
  });

  it("avatar()", () => {
    expect(API.avatar()).toBe("/api/avatar");
  });

  it("proxyFile(url) encodes the URL", () => {
    const url = "https://example.com/file with spaces.pdf";
    expect(API.proxyFile(url)).toBe(
      `/api/proxy-file?url=${encodeURIComponent(url)}`
    );
  });

  // ── Dashboard ─────────────────────────────────────────────────────────

  it("dashboard()", () => {
    expect(API.dashboard()).toBe("/api/dashboard");
  });

  // ── Settings ──────────────────────────────────────────────────────────

  it("changeEmail()", () => {
    expect(API.changeEmail()).toBe("/api/settings/change-email");
  });

  it("verifyEmailChange()", () => {
    expect(API.verifyEmailChange()).toBe("/api/settings/verify-email-change");
  });

  // ── Client Portal ─────────────────────────────────────────────────────

  it("clientProjects()", () => {
    expect(API.clientProjects()).toBe("/api/client/projects");
  });
});
