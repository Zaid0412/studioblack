"use client";

import type { LucideIcon } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  OptionWithIcon,
} from "@/components/ui/select";

export interface LabeledSelectOption {
  value: string;
  label: string;
  /** Optional leading icon, shown in the menu row and the selected value. */
  icon?: LucideIcon;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: LabeledSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Render a red `*` after the label, matching `Input`. */
  required?: boolean;
}

/**
 * Labeled wrapper around the Select primitive for small fixed enums — saves
 * repeating the `<label> + <Select>/<SelectTrigger>/<SelectContent>` boilerplate
 * at every call site (mirrors LabeledSearchableSelect for the searchable case).
 */
export function LabeledSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-text-secondary">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <OptionWithIcon icon={o.icon}>{o.label}</OptionWithIcon>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
