import type { RfqDistributionMethod } from "@/lib/validations";
import { RESPONSE_SOURCE_LABELS, RESPONSE_SOURCE_ICONS } from "@/lib/rfqLabels";

/**
 * Small chip showing how an RFQ reached a vendor (§11). Unlike
 * `ResponseSourceBadge`, `portal` is shown — a portal-only invite (the vendor
 * has no receives_rfq contact) is meaningful distribution info, not a hidden
 * default. Labels/icons are shared with the response-source badge.
 */
export function DistributionMethodBadge({
  method,
}: {
  method: RfqDistributionMethod;
}) {
  const Icon = RESPONSE_SOURCE_ICONS[method];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
      <Icon className="w-3 h-3" />
      {RESPONSE_SOURCE_LABELS[method]}
    </span>
  );
}
