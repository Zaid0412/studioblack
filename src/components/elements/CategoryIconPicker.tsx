"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { CategoryIconBrowseDialog } from "./CategoryIconBrowseDialog";
import { DEFAULT_CATEGORY_ICONS as DEFAULT_ICONS } from "./categoryIcons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CategoryIconPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  color?: string | null;
  label?: string;
}

/**
 * Inline quick-pick icon row with a "Browse all" escape hatch.
 * If `value` is outside the defaults, a trailing tile shows the current
 * selection so it remains reachable without re-opening the browse dialog.
 */
export function CategoryIconPicker({
  value,
  onChange,
  color,
  label,
}: CategoryIconPickerProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const isCustom =
    value != null && !(DEFAULT_ICONS as readonly string[]).includes(value);

  const renderTile = (name: string | null, key: string) => {
    const selected = value === name;
    return (
      <Tooltip key={key} delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(name)}
            aria-label={name ? `Select icon ${name}` : "Clear icon"}
            aria-pressed={selected}
            className={cn(
              "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-2 border-accent-strong bg-accent/10"
                : "border-border-default bg-bg-input hover:border-accent-strong/60"
            )}
          >
            <CategoryIcon icon={name} color={color ?? null} size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{name ?? "Clear icon"}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {DEFAULT_ICONS.map((name) => renderTile(name, name))}
        {isCustom && renderTile(value, `custom-${value}`)}
        <button
          type="button"
          onClick={() => setBrowseOpen(true)}
          className={cn(
            "flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border-default bg-transparent px-3 text-[12px] text-text-secondary",
            "hover:border-accent-strong/60 hover:text-text-primary"
          )}
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Browse all
        </button>
      </div>
      <CategoryIconBrowseDialog
        open={browseOpen}
        value={value}
        color={color ?? null}
        onOpenChange={setBrowseOpen}
        onSelect={onChange}
      />
    </div>
  );
}
