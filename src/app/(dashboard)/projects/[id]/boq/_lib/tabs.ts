import type { UserRole } from "@/types";

/**
 * BOQ sub-tab definitions.
 *
 * The BOQ surface is becoming a tab container with six sub-tabs. Today
 * only `Scope` is implemented — the others sit here with
 * `enabled: false` so flipping them to `true` (and dropping the route
 * folder + content) is a one-line change.
 */
export interface BoqTab {
  label: string;
  /** kebab-case URL segment under /boq/ — also used as the React key. */
  segment: string;
  /** When false, the tab is invisible in the UI. The route directory may not exist. */
  enabled: boolean;
  /**
   * Optional role whitelist. When omitted the tab is visible to everyone with
   * project access; when set, only the listed roles see the tab in the strip
   * (the API layer still enforces access independently).
   */
  roles?: readonly UserRole[];
}

export const BOQ_TABS: readonly BoqTab[] = [
  { label: "Scope", segment: "my-scope", enabled: true },
  {
    label: "RFQ",
    segment: "rfq",
    enabled: true,
    // RFQ is studio↔vendor procurement — clients and vendors must not see
    // the tab. API routes additionally `blockedRoles: ["client", "vendor"]`.
    roles: ["pm", "architect"],
  },
  { label: "Proposal For Client", segment: "client-proposal", enabled: false },
  { label: "Client Orders", segment: "client-orders", enabled: false },
  { label: "Client Invoices", segment: "client-invoices", enabled: false },
  { label: "Payments From Client", segment: "payments", enabled: false },
];

export const VISIBLE_BOQ_TABS = BOQ_TABS.filter((t) => t.enabled);

/** Filter the visible tabs against the viewer's role. */
export function tabsForRole(role: UserRole | null | undefined): BoqTab[] {
  return VISIBLE_BOQ_TABS.filter(
    (t) => !t.roles || (role && t.roles.includes(role))
  );
}

/**
 * Default sub-tab — the redirect target for `/boq` and the link target
 * for the workflow stepper's BOQ button. Falls back to `"my-scope"` if
 * every tab is disabled (defence in depth; that state would mean the
 * BOQ feature is unreachable anyway).
 */
export const DEFAULT_BOQ_SEGMENT: string =
  VISIBLE_BOQ_TABS[0]?.segment ?? "my-scope";
