"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { CategoryIconBrowseDialog } from "./CategoryIconBrowseDialog";
import { cn } from "@/lib/utils";

const DEFAULT_ICONS = ["BrickWall", "Square", "Paintbrush", "Droplet"] as const;

interface CategoryIconPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  color?: string | null;
  label?: string;
}

/**
 * Inline 4-tile icon picker with a "Browse all" escape hatch.
 * If `value` is outside the 4 defaults, a 5th tile shows the current
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
      <button
        key={key}
        type="button"
        onClick={() => onChange(name)}
        aria-label={name ? `Select icon ${name}` : "Clear icon"}
        aria-pressed={selected}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
          selected
            ? "border-accent bg-accent/10"
            : "border-border-default bg-bg-input hover:border-accent/60"
        )}
      >
        <CategoryIcon icon={name} color={selected ? color : null} size={18} />
      </button>
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
            "flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border-default bg-transparent px-3 text-[12px] text-text-secondary",
            "hover:border-accent/60 hover:text-text-primary"
          )}
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Browse all
        </button>
      </div>
      <CategoryIconBrowseDialog
        open={browseOpen}
        value={value}
        onOpenChange={setBrowseOpen}
        onSelect={onChange}
      />
    </div>
  );
}
