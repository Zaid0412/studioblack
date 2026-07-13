"use client";

import { useTranslations } from "next-intl";
import { CategorySelect } from "@/app/(dashboard)/elements/_components/CategorySelect";
import { ServiceAreaDialog } from "@/components/elements/ServiceAreaDialog";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { SERVICE_AREA_DEPTH } from "@/app/(dashboard)/elements/_lib/categoryUtils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
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
 * The picker deliberately still *shows* Categories and Sub-categories — greyed
 * out — because a leaf like "Base Cabinets" is unreadable without "Kitchen ›
 * Cabinets" above it, and because a grandfathered record pointing at a shallower
 * node must keep displaying its current value rather than showing blank.
 *
 * The hint only appears once the tree has loaded: until then nothing can be
 * resolved to a Service Area, and flashing "this is required" at a record that
 * already has one is a lie.
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
      <CategorySelect
        label={label}
        value={value}
        onChange={onChange}
        tree={tree}
        selectableDepth={SERVICE_AREA_DEPTH}
        clearable={false}
        disabled={disabled}
        placeholder={t("serviceAreaPlaceholder")}
        renderCreate={({ open, onOpenChange, onCreated }) => (
          <ServiceAreaDialog
            open={open}
            tree={tree}
            onOpenChange={onOpenChange}
            onCreated={onCreated}
          />
        )}
      />
      {!disabled && loaded && !isServiceAreaId(value) && (
        <p className="text-xs text-warning">{requiredHint}</p>
      )}
    </div>
  );
}

/** Re-exported so hosts can gate their own submit on the same rule. */
export { useCategoryTree };
