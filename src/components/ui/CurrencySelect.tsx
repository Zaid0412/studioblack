"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";

interface Props {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

function getCurrencyOptions(locale: string) {
  const codes =
    (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("currency") ?? [];
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  return codes.map((code) => ({ code, name: names.of(code) ?? code }));
}

export function CurrencySelect({
  value,
  onChange,
  label,
  required,
  disabled,
}: Props) {
  const locale = useLocale();
  const options = useMemo(() => getCurrencyOptions(locale), [locale]);

  return (
    <LabeledSearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      required={required}
      disabled={disabled}
      minContentWidth={280}
      maxListHeight={280}
    />
  );
}
