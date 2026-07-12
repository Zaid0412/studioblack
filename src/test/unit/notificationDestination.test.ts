/**
 * Pin the notification deep-link rules. Routing is entity-first: the most
 * specific id on the row wins, so a task notification opens the task even when
 * that task has no project. BOQ is the exception — the row carries no BOQ item
 * id, so its sub-tab is still selected by the `boq_` type prefix.
 *
 * The rules below are keyed off the ids, not the type, so one case per branch
 * is the whole rule — looping every notification type through a branch that
 * ignores the type pins nothing extra.
 */
import { describe, it, expect } from "vitest";
import { notificationDestination } from "@/lib/notificationDestination";

const PROJECT = "proj-1";
const TASK = "task-1";

describe("notificationDestination", () => {
  it("routes boq_ types into the BOQ sub-tab", () => {
    expect(
      notificationDestination({
        type: "boq_item_review_requested",
        projectId: PROJECT,
      })
    ).toBe(`/projects/${PROJECT}/boq/my-scope`);
  });

  it("routes other project-scoped types to the project root", () => {
    expect(
      notificationDestination({ type: "approval", projectId: PROJECT })
    ).toBe(`/projects/${PROJECT}`);
  });

  // The bug that started this: quote notifications carried only the project, so
  // they landed on /designs instead of the RFQ the vendor had just quoted on.
  it("opens the RFQ for quote notifications", () => {
    expect(
      notificationDestination({
        type: "quote_received",
        projectId: PROJECT,
        rfqId: "rfq-1",
      })
    ).toBe(`/projects/${PROJECT}/order/rfq/rfq-1`);
  });

  it("opens the design for review notifications", () => {
    expect(
      notificationDestination({
        type: "review_approved",
        projectId: PROJECT,
        attachmentId: "att-1",
      })
    ).toBe(`/projects/${PROJECT}/review/att-1`);
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
      notificationDestination({ type: "task_assigned", taskId: TASK })
    ).toBe(`/tasks/${TASK}`);
  });

  it("returns null when there is nowhere to go", () => {
    expect(notificationDestination({ type: "invitation" })).toBeNull();
    // Names a design, but the review route is nested under the project.
    expect(
      notificationDestination({
        type: "review_approved",
        attachmentId: "att-1",
      })
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
  });
});
