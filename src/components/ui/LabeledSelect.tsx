"use client";

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
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
