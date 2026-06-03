import { describe, it, expect } from "vitest";
import {
  defineWorkflowTabs,
  type WorkflowTab,
} from "@/components/projects/workflowTabs";

type Key = "a" | "b" | "c";

describe("defineWorkflowTabs", () => {
  it("visibleTabs keeps only enabled tabs, in declaration order", () => {
    const tabs: WorkflowTab<Key>[] = [
      { labelKey: "a", segment: "a", enabled: true },
      { labelKey: "b", segment: "b", enabled: false },
      { labelKey: "c", segment: "c", enabled: true },
    ];
    const { visibleTabs } = defineWorkflowTabs(tabs, "a");
    expect(visibleTabs.map((t) => t.segment)).toEqual(["a", "c"]);
  });

  it("defaultSegment is the first visible tab's segment", () => {
    const { defaultSegment } = defineWorkflowTabs<Key>(
      [
        { labelKey: "a", segment: "a", enabled: false },
        { labelKey: "b", segment: "b", enabled: true },
      ],
      "fallback"
    );
    expect(defaultSegment).toBe("b");
  });

  it("defaultSegment falls back when every tab is disabled", () => {
    const { defaultSegment } = defineWorkflowTabs<Key>(
      [{ labelKey: "a", segment: "a", enabled: false }],
      "fallback"
    );
    expect(defaultSegment).toBe("fallback");
  });

  describe("tabsForRole", () => {
    const { tabsForRole } = defineWorkflowTabs<Key>(
      [
        { labelKey: "a", segment: "open", enabled: true },
        {
          labelKey: "b",
          segment: "studio",
          enabled: true,
          roles: ["pm", "architect"],
        },
      ],
      "open"
    );

    it("shows whitelisted tabs only to listed roles", () => {
      expect(tabsForRole("pm").map((t) => t.segment)).toEqual([
        "open",
        "studio",
      ]);
      expect(tabsForRole("architect").map((t) => t.segment)).toEqual([
        "open",
        "studio",
      ]);
    });

    it("hides whitelisted tabs from non-listed roles", () => {
      expect(tabsForRole("client").map((t) => t.segment)).toEqual(["open"]);
      expect(tabsForRole("vendor").map((t) => t.segment)).toEqual(["open"]);
    });

    it("hides whitelisted tabs when role is null/undefined", () => {
      expect(tabsForRole(null).map((t) => t.segment)).toEqual(["open"]);
      expect(tabsForRole(undefined).map((t) => t.segment)).toEqual(["open"]);
    });

    it("always shows tabs without a roles whitelist", () => {
      expect(tabsForRole(null).map((t) => t.segment)).toContain("open");
    });
  });
});
