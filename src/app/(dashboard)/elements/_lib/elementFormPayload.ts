import type { ComponentProps } from "react";
import type { ElementFormDialog } from "../_components/ElementFormDialog";

/** The already-parsed values the element form hands back on submit. */
export type ElementSubmitValues = Parameters<
  ComponentProps<typeof ElementFormDialog>["onSubmit"]
>[0];

/**
 * Map the element form's submit values to the create/update API payload.
 * Shared by the library list and the element detail page so the field mapping
 * (and its `|| undefined` empty-string handling) lives in one place.
 */
export function buildElementMutationPayload(values: ElementSubmitValues) {
  return {
    name: values.name,
    description: values.description || undefined,
    categoryId: values.categoryId,
    unit: values.unit,
    unitCost: values.unitCost,
    currency: values.currency,
    materialCost: values.materialCost,
    labourCost: values.labourCost,
    overheadPct: values.overheadPct,
    serviceChargePct: values.serviceChargePct,
    marginPct: values.marginPct,
    clientRate: values.clientRate,
    budgetRate: values.budgetRate,
    specReference: values.specReference || undefined,
    drawingRef: values.drawingRef || undefined,
    tags: values.tags,
    attributes: values.attributes.map((a, i) => ({
      attribute_key: a.attribute_key,
      attribute_value: a.attribute_value,
      unit: a.unit,
      sort_order: i,
    })),
    imageUrl: values.imageUrl,
    drawingFileUrl: values.drawingFileUrl,
    drawingFileName: values.drawingFileName,
    specFileUrl: values.specFileUrl,
    specFileName: values.specFileName,
  };
}
