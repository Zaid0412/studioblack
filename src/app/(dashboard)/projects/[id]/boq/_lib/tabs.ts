/**
 * BOQ sub-tab definitions.
 *
 * The BOQ surface is becoming a tab container with six sub-tabs. Today
 * only `My Scope` is implemented — the others sit here with
 * `enabled: false` so flipping them to `true` (and dropping the route
 * folder + content) is a one-line change. The tab strip in
 * `boq/layout.tsx` reads `VISIBLE_BOQ_TABS` and renders nothing extra
 * until ≥ 2 tabs are enabled, so users today see no tabs UI at all.
 */
export type BoqTabKey =
  | "my_scope"
  | "rfq"
  | "client_proposal"
  | "client_orders"
  | "client_invoices"
  | "payments";

export interface BoqTab {
  key: BoqTabKey;
  label: string;
  /** kebab-case URL segment under /boq/ */
  segment: string;
  /** When false, the tab is invisible in the UI. The route directory may not exist. */
  enabled: boolean;
}

export const BOQ_TABS: readonly BoqTab[] = [
  { key: "my_scope", label: "My Scope", segment: "my-scope", enabled: true },
  { key: "rfq", label: "RFQ", segment: "rfq", enabled: false },
  {
    key: "client_proposal",
    label: "Proposal For Client",
    segment: "client-proposal",
    enabled: false,
  },
  {
    key: "client_orders",
    label: "Client Orders",
    segment: "client-orders",
    enabled: false,
  },
  {
    key: "client_invoices",
    label: "Client Invoices",
    segment: "client-invoices",
    enabled: false,
  },
  {
    key: "payments",
    label: "Payments From Client",
    segment: "payments",
    enabled: false,
  },
];

export const VISIBLE_BOQ_TABS = BOQ_TABS.filter((t) => t.enabled);
