import { RFQ_ELIGIBLE_PHASES, isProcurementCommitted } from "@/lib/validations";
import type { BoqItemWithComputed } from "@/types";

/**
 * Only Ready-for-Procurement BOQ items may enter an RFQ (the client half of
 * the RFQ-4a gate the server enforces in `addRfqItems`/`createRfqDraft`).
 */
export function isRfqEligiblePhase(
  item: Pick<BoqItemWithComputed, "phase">
): boolean {
  return RFQ_ELIGIBLE_PHASES.includes(item.phase);
}

/**
 * Soft, per-status tint for a disabled row's reason pill — very light fills so
 * the badges read as a quiet hint, not a loud status. Keyed by `po_status`;
 * unknown statuses fall back to neutral.
 */
const DISABLED_TONE: Record<string, string> = {
  rfq_issued: "bg-info/10 text-info border-info/20",
  quoted: "bg-warning/10 text-warning border-warning/20",
  po_raised: "bg-accent/10 text-accent-strong border-accent-strong/20",
  delivered: "bg-success/10 text-success border-success/20",
};
const NEUTRAL_TONE = "bg-bg-elevated text-text-muted border-border-default";

/**
 * Reason pill (label + tone) for every procurement-committed item in `items`,
 * keyed by item id (absent → selectable). `label` resolves a `po_status` to a
 * localized string; the tone map is shared so both RFQ pickers (create form +
 * add-items dialog) read identically.
 */
export function buildDisabledReasons(
  items: ReadonlyArray<BoqItemWithComputed>,
  label: (poStatus: string) => string
): Record<string, { label: string; tone: string }> {
  const map: Record<string, { label: string; tone: string }> = {};
  for (const it of items) {
    if (isProcurementCommitted(it.po_status)) {
      map[it.id] = {
        label: label(it.po_status),
        tone: DISABLED_TONE[it.po_status] ?? NEUTRAL_TONE,
      };
    }
  }
  return map;
}
