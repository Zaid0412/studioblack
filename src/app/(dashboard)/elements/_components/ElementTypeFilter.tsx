"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ELEMENT_TYPES, type ElementType } from "@/lib/validations";

const ALL = "__all__";

interface Props {
  value: ElementType | null;
  onChange: (type: ElementType | null) => void;
}

/** Filter the elements table by provenance type (Standard / Custom / Company Standard). */
export function ElementTypeFilter({ value, onChange }: Props) {
  const t = useTranslations("elements");

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? null : (v as ElementType))}
    >
      <SelectTrigger>
        <SelectValue placeholder={t("filterByType")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
        {ELEMENT_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {t(`elementType.${type}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
