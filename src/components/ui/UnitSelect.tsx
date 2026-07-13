"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";

interface Props {
  value: ElementUnit;
  onChange: (unit: ElementUnit) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Compact, code-only trigger — for the inline BOQ table cell. */
  compact?: boolean;
  triggerClassName?: string;
}

/** Searchable dropdown for the allowed element units (m2, lm, no, …) with translated labels. */
export function UnitSelect({
  value,
  onChange,
  label,
  required,
  disabled,
  compact,
  triggerClassName,
}: Props) {
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
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      required={required}
      disabled={disabled}
      codeColumnClassName="w-14"
      triggerSize={compact ? "sm" : "md"}
      hideTriggerName={compact}
      triggerClassName={triggerClassName}
    />
  );
}
