import {
  defineWorkflowTabs,
  type WorkflowTab,
} from "@/components/projects/workflowTabs";

/** Closed union of i18n keys under the `boq.tabs` namespace. */
export type BoqTabLabelKey =
  | "scope"
  | "clientProposal"
  | "clientOrders"
  | "clientInvoices"
  | "payments";

type BoqTab = WorkflowTab<BoqTabLabelKey>;

/**
 * BOQ sub-tab definitions. Disabled entries sit here with `enabled: false`
 * so flipping them to `true` (and dropping the route folder + content) is a
 * one-line change.
 */
const BOQ_TABS: readonly BoqTab[] = [
  { labelKey: "scope", segment: "my-scope", enabled: true },
  { labelKey: "clientProposal", segment: "client-proposal", enabled: false },
  { labelKey: "clientOrders", segment: "client-orders", enabled: false },
  { labelKey: "clientInvoices", segment: "client-invoices", enabled: false },
  { labelKey: "payments", segment: "payments", enabled: false },
];

export const { tabsForRole, defaultSegment: DEFAULT_BOQ_SEGMENT } =
  defineWorkflowTabs<BoqTabLabelKey>(BOQ_TABS, "my-scope");
