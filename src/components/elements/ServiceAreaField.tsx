"use client";

import { useTranslations } from "next-intl";
import { ServiceAreaSelect } from "@/components/elements/ServiceAreaSelect";
import { serviceAreaCreate } from "@/components/elements/ServiceAreaDialog";
import { useCategoryTree } from "@/hooks/useCategoryTree";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Omitted inside a table row, where the column header is the label. */
  label?: string;
  /** Shown under the field when nothing valid is picked. */
  requiredHint: string;
  /** Only fetch the tree while the host dialog is open. */
  enabled?: boolean;
  disabled?: boolean;
}

/**
 * Pick the Service Area something belongs to, and build one inline if it
 * doesn't exist yet.
 *
 * The hint only appears once the tree has loaded: until then nothing can be
 * resolved to a Service Area, and flashing "this is required" at a record that
 * already has one is a lie. It is what a grandfathered record — one pointing at
 * a Category rather than a Service Area — shows instead of silently passing;
 * the picker still renders that value, and opens on the children it must be
 * replaced with.
 */
export function ServiceAreaField({
  value,
  onChange,
  label,
  requiredHint,
  enabled = true,
  disabled = false,
}: Props) {
  const t = useTranslations("elements");
  const { tree, isServiceAreaId, loaded } = useCategoryTree(enabled);

  return (
    <div className="flex flex-col gap-1.5">
      <ServiceAreaSelect
        label={label}
        value={value}
        onChange={onChange}
        tree={tree}
        disabled={disabled}
        // Always marked: the asterisk states that the record needs one, which
        // stays true while the field is locked. (The *hint* below is suppressed
        // when locked — that one is a call to action.)
        required
        placeholder={t("serviceAreaPlaceholder")}
        renderCreate={serviceAreaCreate(tree)}
      />
      {!disabled && loaded && !isServiceAreaId(value) && (
        <p className="text-xs text-warning">{requiredHint}</p>
      )}
    </div>
  );
}

/** Re-exported so hosts can gate their own submit on the same rule. */
export { useCategoryTree };
