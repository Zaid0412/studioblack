"use client";

import type { LucideIcon } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-text-secondary">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const Icon = o.icon;
            return (
              <SelectItem key={o.value} value={o.value}>
                {Icon ? (
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-text-muted" />
                    {o.label}
                  </span>
                ) : (
                  o.label
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
