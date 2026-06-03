import type { UserRole } from "@/types";

/**
 * One sub-tab under a workflow step (BOQ, Order, ...). `K` is the closed
 * union of i18n keys for that step's namespace, so a typo in a tab list is
 * a compile error without coupling the tab config to the messages bundle.
 */
export interface WorkflowTab<K extends string> {
  /** i18n key under the step's `*.tabs` namespace — resolved by the strip. */
  labelKey: K;
  /** kebab-case URL segment under the step's base path — also the React key. */
  segment: string;
  /** When false, the tab is invisible in the UI. The route directory may not exist. */
  enabled: boolean;
  /**
   * Optional role whitelist. When omitted the tab is visible to everyone with
   * project access; when set, only the listed roles see it in the strip (the
   * API layer enforces the same boundary independently).
   */
  roles?: readonly UserRole[];
}

export interface WorkflowTabsConfig<K extends string> {
  /** Tabs with `enabled: true`, in declaration order. */
  visibleTabs: WorkflowTab<K>[];
  /** Visible tabs filtered against the viewer's role. */
  tabsForRole: (role: UserRole | null | undefined) => WorkflowTab<K>[];
  /**
   * Redirect target for the step's index route and the stepper's link. Falls
   * back to `fallbackSegment` if every tab is disabled (defence in depth —
   * that state means the step is unreachable anyway).
   */
  defaultSegment: string;
}

/**
 * Build the derived helpers (visible list, role filter, default segment) for
 * a workflow step's tab config. Shared by BOQ and Order so the two only
 * declare their tab arrays + label-key unions.
 */
export function defineWorkflowTabs<K extends string>(
  tabs: readonly WorkflowTab<K>[],
  fallbackSegment: string
): WorkflowTabsConfig<K> {
  const visibleTabs = tabs.filter((t) => t.enabled);
  return {
    visibleTabs,
    tabsForRole: (role) =>
      visibleTabs.filter((t) => !t.roles || (role && t.roles.includes(role))),
    defaultSegment: visibleTabs[0]?.segment ?? fallbackSegment,
  };
}
