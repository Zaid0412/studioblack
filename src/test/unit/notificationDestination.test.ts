/**
 * Pin the notification deep-link rules. Routing is entity-first: the most
 * specific id on the row wins, so a task notification opens the task even when
 * that task has no project. BOQ is the exception — the row carries no BOQ item
 * id, so its sub-tab is still selected by the `boq_` type prefix.
 */
import { describe, it, expect } from "vitest";
import { notificationDestination } from "@/lib/notificationDestination";

const PROJECT = "proj-1";
const TASK = "task-1";

describe("notificationDestination", () => {
  it("routes boq_ types into the BOQ sub-tab", () => {
    for (const type of [
      "boq_item_review_requested",
      "boq_item_internally_approved",
      "boq_item_client_approved",
      "boq_item_client_changes_requested",
      "boq_item_internal_changes_requested",
    ]) {
      expect(notificationDestination({ type, projectId: PROJECT })).toBe(
        `/projects/${PROJECT}/boq/my-scope`
      );
    }
  });

  it("routes other project-scoped types to the project root", () => {
    for (const type of ["approval", "upload", "project_pm_assigned"]) {
      expect(notificationDestination({ type, projectId: PROJECT })).toBe(
        `/projects/${PROJECT}`
      );
    }
  });

  // The bug that started this: quote notifications carried only the project, so
  // they landed on /designs instead of the RFQ the vendor had just quoted on.
  it("opens the RFQ for quote notifications", () => {
    for (const type of ["quote_received", "quote_revised", "quote_declined"]) {
      expect(
        notificationDestination({ type, projectId: PROJECT, rfqId: "rfq-1" })
      ).toBe(`/projects/${PROJECT}/order/rfq/rfq-1`);
    }
  });

  it("opens the design for review notifications", () => {
    for (const type of [
      "upload",
      "review_approved",
      "review_changes_requested",
      "design_sent_for_review",
    ]) {
      expect(
        notificationDestination({
          type,
          projectId: PROJECT,
          attachmentId: "att-1",
        })
      ).toBe(`/projects/${PROJECT}/review/att-1`);
    }
  });

  it("opens the task when a task id is present, ahead of the project", () => {
    expect(
      notificationDestination({
        type: "task_assigned",
        projectId: PROJECT,
        taskId: TASK,
      })
    ).toBe(`/tasks/${TASK}`);
  });

  it("opens a standalone task that has no project", () => {
    expect(
      notificationDestination({
        type: "task_assigned",
        projectId: null,
        taskId: TASK,
      })
    ).toBe(`/tasks/${TASK}`);
  });

  it("returns null when there is nowhere to go", () => {
    expect(notificationDestination({ type: "invitation" })).toBeNull();
    expect(
      notificationDestination({ type: "boq_item_review_requested" })
    ).toBeNull();
  });

  // Synthetic invitations have no DB row and so no entity ids -- an explicit
  // href is the only way they can lead anywhere.
  it("prefers an explicit href", () => {
    expect(
      notificationDestination({
        type: "invitation",
        href: "/settings?section=organization",
      })
    ).toBe("/settings?section=organization");

    expect(
      notificationDestination({
        type: "task_assigned",
        projectId: PROJECT,
        taskId: TASK,
        href: "/somewhere",
      })
    ).toBe("/somewhere");
  });
});
