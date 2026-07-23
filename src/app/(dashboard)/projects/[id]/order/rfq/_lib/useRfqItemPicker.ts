import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { isProcurementCommitted } from "@/lib/validations";
import type { BoqItemWithComputed } from "@/types";
import { buildDisabledReasons, isRfqEligiblePhase } from "./itemEligibility";

/**
 * Shared RFQ picker gate for the create form and the add-items dialog.
 *
 * - `eligible`   — Ready-for-Procurement items, minus `exclude` (rows shown).
 * - `selectable` — the uncommitted subset that can actually be picked.
 * - `disabledReasons` — reason pill per committed row (keyed by item id).
 *
 * Centralised so the two pickers can't drift: that drift is exactly what let
 * ineligible items reach the server and fail the RFQ-4a gate (bad_items → 400).
 */
export function useRfqItemPicker(
  items: readonly BoqItemWithComputed[] | undefined,
  exclude?: ReadonlySet<string>
) {
  const tDisabled = useTranslations("rfq.create.itemDisabled");

  const eligible = useMemo(
    () =>
      (items ?? []).filter(
        (it) => isRfqEligiblePhase(it) && !exclude?.has(it.id)
      ),
    [items, exclude]
  );
  const selectable = useMemo(
    () => eligible.filter((it) => !isProcurementCommitted(it.po_status)),
    [eligible]
  );
  const disabledReasons = useMemo(
    () => buildDisabledReasons(eligible, tDisabled),
    [eligible, tDisabled]
  );

  return { eligible, selectable, disabledReasons };
}
