"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import { ELEMENT_TYPES, type ElementType } from "@/lib/validations";

interface Props {
  value: ElementType | null;
  onChange: (type: ElementType | null) => void;
  className?: string;
}

/** Filter the elements table by provenance type (Standard / Custom / Company Standard). */
export function ElementTypeFilter({ value, onChange, className }: Props) {
  const t = useTranslations("elements");

  const options = useMemo(
    () =>
      ELEMENT_TYPES.map((code) => ({ code, name: t(`elementType.${code}`) })),
    [t]
  );

  return (
    <LabeledSearchableSelect<ElementType>
      value={value ?? ""}
      onChange={(v: ElementType | "") => onChange(v === "" ? null : v)}
      options={options}
      minContentWidth={200}
      triggerSize="sm"
      triggerPlaceholder={t("filterByType")}
      hideTriggerName
      triggerClassName={className}
      allowClear={{ label: t("allTypes") }}
    />
  );
}
