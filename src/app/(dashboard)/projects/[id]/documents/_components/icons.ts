import { icons, type LucideIcon } from "lucide-react";

/**
 * Common icons surfaced in the section dialog's quick-pick grid. Names are
 * PascalCase to match lucide-react's `icons` export (and the rest of the
 * codebase — see `CategoryIconBrowseDialog`). Users who need anything else
 * pick from the full browser dialog.
 */
export const COMMON_SECTION_ICONS = [
  "Folder",
  "ShieldCheck",
  "FileText",
  "Receipt",
  "ClipboardList",
  "FilePenLine",
  "Image",
  "Hammer",
  "Briefcase",
  "Calculator",
  "Building2",
  "ScrollText",
] as const;

/** Resolve a lucide icon by PascalCase name; falls back to Folder. */
export function getSectionIcon(name: string): LucideIcon {
  return (
    (icons[name as keyof typeof icons] as LucideIcon | undefined) ??
    icons.Folder
  );
}
