"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDivisions } from "@/hooks/useDivisions";

/** Sentinel for "no division" — Radix Select can't use an empty-string value. */
const NO_DIVISION = "__none__";

/**
 * Division picker for the section create/edit dialogs. Offers the enabled
 * divisions from the org library plus a "No division" option. A section that
 * already sits under a now-disabled division still shows it, so editing an
 * unrelated field doesn't silently drop the assignment.
 */
export function BoqDivisionSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (divisionId: string | null) => void;
}) {
  const { enabledDivisions, byId } = useDivisions();

  // Keep a disabled-but-assigned division visible in the list.
  const options = [...enabledDivisions];
  if (value && !options.some((d) => d.id === value)) {
    const current = byId.get(value);
    if (current) options.push(current);
  }

  return (
    <Select
      value={value ?? NO_DIVISION}
      onValueChange={(v) => onChange(v === NO_DIVISION ? null : v)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_DIVISION}>No division</SelectItem>
        {options.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.code} — {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
