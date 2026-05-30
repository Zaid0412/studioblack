"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoryIconBrowseDialog } from "@/components/elements/CategoryIconBrowseDialog";
import { cn } from "@/lib/utils";
import { COMMON_SECTION_ICONS, getSectionIcon } from "./icons";

interface Props {
  name: string;
  icon: string;
  onNameChange: (next: string) => void;
  onIconChange: (next: string) => void;
  /** Defaults to true for the New dialog; Rename pre-fills so no autofocus needed. */
  autoFocusName?: boolean;
  /** Placeholder shown only when the name field is empty (new-section flow). */
  namePlaceholder?: string;
}

/**
 * Shared "name + icon" picker used by both the New and Rename section
 * dialogs. Owns the browse-all dialog state internally.
 */
export function SectionNameAndIconFields({
  name,
  icon,
  onNameChange,
  onIconChange,
  autoFocusName = true,
  namePlaceholder,
}: Props) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const selectedIsCommon = (COMMON_SECTION_ICONS as readonly string[]).includes(
    icon
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">Name</label>
        <Input
          autoFocus={autoFocusName}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          maxLength={80}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">Icon</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {COMMON_SECTION_ICONS.map((key) => {
            const Icon = getSectionIcon(key);
            const active = key === icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onIconChange(key)}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-md border transition-colors cursor-pointer",
                  active
                    ? "bg-accent border-accent text-text-on-accent"
                    : "bg-bg-primary border-border-default text-text-secondary hover:bg-bg-elevated"
                )}
                aria-pressed={active}
                aria-label={key}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          {!selectedIsCommon && (
            <button
              key={`custom-${icon}`}
              type="button"
              onClick={() => setBrowserOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-md border-2 border-accent bg-accent/10 text-accent cursor-pointer"
              aria-pressed
              aria-label={`Current icon: ${icon}`}
              title={icon}
            >
              {(() => {
                const Icon = getSectionIcon(icon);
                return <Icon className="w-4 h-4" />;
              })()}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBrowserOpen(true)}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border-default bg-transparent px-3 text-[12px] text-text-secondary",
              "hover:border-accent/60 hover:text-text-primary"
            )}
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            Browse all
          </button>
        </div>
      </div>

      <CategoryIconBrowseDialog
        open={browserOpen}
        value={icon}
        onOpenChange={setBrowserOpen}
        onSelect={(picked) => onIconChange(picked)}
      />
    </>
  );
}
