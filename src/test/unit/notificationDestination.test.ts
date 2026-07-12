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
});
