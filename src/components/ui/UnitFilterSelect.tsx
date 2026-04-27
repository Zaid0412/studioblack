"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";

interface UnitFilterSelectProps {
  value: ElementUnit | null;
  onChange: (unit: ElementUnit | null) => void;
  className?: string;
  /** Defaults to the "filter by unit" placeholder. Pass a custom one per surface. */
  placeholder?: string;
  /** Defaults to the "All units" i18n label. */
  allLabel?: string;
}

/**
 * Inline filter dropdown for the elements + BOQ tables. Thin wrapper around
 * `LabeledSearchableSelect` with `allowClear` so "All units" resets the filter.
 */
export function UnitFilterSelect({
  value,
  onChange,
  className,
  placeholder,
  allLabel,
}: UnitFilterSelectProps) {
  const t = useTranslations("elements");

  const options = useMemo(
    () =>
      ALLOWED_UNITS.map((code) => ({
        code,
        name: t(`unitLabels.${code}`),
      })),
    [t]
  );

  return (
    <LabeledSearchableSelect<ElementUnit>
      value={value ?? ""}
      onChange={(v: ElementUnit | "") => onChange(v === "" ? null : v)}
      options={options}
      minContentWidth={220}
      triggerSize="sm"
      triggerPlaceholder={placeholder ?? t("filterByUnit")}
      hideTriggerName
      triggerClassName={className}
      allowClear={{ label: allLabel ?? t("allUnits") }}
    />
  );
}
