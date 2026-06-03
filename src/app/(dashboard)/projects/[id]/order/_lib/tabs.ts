import {
  defineWorkflowTabs,
  type WorkflowTab,
} from "@/components/projects/workflowTabs";

/** Closed union of i18n keys under the `order.tabs` namespace. */
export type OrderTabLabelKey = "rfq";

type OrderTab = WorkflowTab<OrderTabLabelKey>;

/**
 * Order sub-tab definitions. RFQ is studio↔vendor procurement, so clients
 * and vendors are filtered out by the `roles` whitelist.
 */
const ORDER_TABS: readonly OrderTab[] = [
  {
    labelKey: "rfq",
    segment: "rfq",
    enabled: true,
    roles: ["pm", "architect"],
  },
];

export const {
  tabsForRole: orderTabsForRole,
  defaultSegment: DEFAULT_ORDER_SEGMENT,
} = defineWorkflowTabs<OrderTabLabelKey>(ORDER_TABS, "rfq");
