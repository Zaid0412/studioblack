"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { FormDialog } from "@/components/ui/FormDialog";
import { Input } from "@/components/ui/input";
import { CategoryIconBrowseDialog } from "@/components/elements/CategoryIconBrowseDialog";
import { cn } from "@/lib/utils";
import type { DbProjectDocumentSection } from "@/types";
import { COMMON_SECTION_ICONS, getSectionIcon } from "./icons";
import { SectionSelect } from "./SectionSelect";

interface NewSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    icon: string;
    parentId: string | null;
  }) => Promise<void>;
  /** Sections available as parents. Children (already-nested) are filtered
   * out at the picker level since they can't be parents themselves. */
  sections?: DbProjectDocumentSection[];
  /** Pre-fills the parent picker (e.g. "Add sub-section" on a parent row). */
  initialParentId?: string | null;
}

/**
 * Dialog for creating a new document section. Quick-pick grid of common
 * icons + "Browse all" button that opens the shared full-lucide picker
 * (same one used for element categories).
 */
export function NewSectionDialog({
  open,
  onOpenChange,
  onSubmit,
  sections,
  initialParentId,
}: NewSectionDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("Folder");
  const [parentId, setParentId] = useState<string | null>(
    initialParentId ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  // Sync parent pre-fill when the dialog opens from a different entry point
  // (top-level "+ New section" vs "Add sub-section" on a specific parent).
  useEffect(() => {
    if (open) setParentId(initialParentId ?? null);
  }, [open, initialParentId]);

  const selectedIsCommon = (COMMON_SECTION_ICONS as readonly string[]).includes(
    icon
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon, parentId });
      setName("");
      setIcon("Folder");
      setParentId(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setName("");
            setIcon("Folder");
            setParentId(null);
          }
          onOpenChange(v);
        }}
        title="New section"
        submitting={submitting}
        submitLabel="Create"
        submittingLabel="Creating…"
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
            placeholder="e.g. Site Visits"
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
        {sections && sections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <SectionSelect
              label="Parent section (optional)"
              value={parentId}
              onChange={setParentId}
              // Children are already nested — they can't be parents themselves
              // under our one-level cap. They render dimmed in the picker.
              sections={sections}
              isSelectable={(s) => s.parent_id === null}
              placeholder="None — create at top level"
            />
            <p className="text-[11px] text-text-muted">
              Leave blank to create a top-level section.
            </p>
          </div>
        )}
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
