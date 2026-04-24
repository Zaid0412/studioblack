"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoqSection } from "@/types";
import { BOQ_NO_SECTION_ID } from "../_lib/formatters";

interface BoqSectionSelectProps {
  /** Section UUID, or `BOQ_NO_SECTION_ID` for the "(Unassigned)" sentinel. */
  value: string;
  onChange: (next: string) => void;
  sections: BoqSection[];
  label?: string;
}

/** Labeled section dropdown with an "(Unassigned)" option, shared by add-item dialogs. */
export function BoqSectionSelect({
  value,
  onChange,
  sections,
  label = "Section",
}: BoqSectionSelectProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BOQ_NO_SECTION_ID}>(Unassigned)</SelectItem>
          {sections.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
