"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { FormDialog } from "@/components/ui/FormDialog";
import { Input } from "@/components/ui/input";
import { CategoryIconBrowseDialog } from "@/components/elements/CategoryIconBrowseDialog";
import { cn } from "@/lib/utils";
import { COMMON_SECTION_ICONS, getSectionIcon } from "./icons";

interface RenameSectionDialogProps {
  open: boolean;
  /** The section being renamed; controls dialog visibility + initial values. */
  initialName: string;
  initialIcon: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; icon: string }) => Promise<void>;
}

/** Edit a section's name + icon. Same picker pattern as NewSectionDialog. */
export function RenameSectionDialog({
  open,
  initialName,
  initialIcon,
  onOpenChange,
  onSubmit,
}: RenameSectionDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string>(initialIcon);
  const [submitting, setSubmitting] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const selectedIsCommon = (COMMON_SECTION_ICONS as readonly string[]).includes(
    icon
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Rename "${initialName}"`}
        submitting={submitting}
        submitLabel="Save"
        submittingLabel="Saving…"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Name
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Icon
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {COMMON_SECTION_ICONS.map((key) => {
              const Icon = getSectionIcon(key);
              const active = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-md border transition-colors",
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
                className="flex items-center justify-center w-9 h-9 rounded-md border-2 border-accent bg-accent/10 text-accent"
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
      </FormDialog>

      <CategoryIconBrowseDialog
        open={browserOpen}
        value={icon}
        onOpenChange={setBrowserOpen}
        onSelect={(picked) => setIcon(picked)}
      />
    </>
  );
}
