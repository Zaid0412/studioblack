/**
 * Pin the notification deep-link rule. BOQ notifications must route into
 * the BOQ sub-tab so the user lands on the surface they're being notified
 * about, not on the project root where they'd have to click again.
 */
import { describe, it, expect } from "vitest";
import { notificationDestination } from "@/lib/notificationDestination";

const PROJECT = "proj-1";

describe("notificationDestination", () => {
  it("routes boq_item_review_requested into the BOQ tab", () => {
    expect(notificationDestination("boq_item_review_requested", PROJECT)).toBe(
      `/projects/${PROJECT}/boq/my-scope`
    );
  });

  it("routes boq_item_internally_approved into the BOQ tab", () => {
    expect(
      notificationDestination("boq_item_internally_approved", PROJECT)
    ).toBe(`/projects/${PROJECT}/boq/my-scope`);
  });

  it("routes boq_item_client_approved into the BOQ tab", () => {
    expect(notificationDestination("boq_item_client_approved", PROJECT)).toBe(
      `/projects/${PROJECT}/boq/my-scope`
    );
  });

  it("routes boq_item_change_requested into the BOQ tab", () => {
    expect(notificationDestination("boq_item_change_requested", PROJECT)).toBe(
      `/projects/${PROJECT}/boq/my-scope`
    );
  });

  it("routes non-boq types to the project root", () => {
    expect(notificationDestination("task_assigned", PROJECT)).toBe(
      `/projects/${PROJECT}`
    );
    expect(notificationDestination("attachment_uploaded", PROJECT)).toBe(
      `/projects/${PROJECT}`
    );
    expect(notificationDestination("project_approved", PROJECT)).toBe(
      `/projects/${PROJECT}`
    );
  });
});
