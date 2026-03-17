/**
 * Shared activity type → icon/color maps used by dashboard and audit pages.
 * Icon components are imported from lucide-react by consumers.
 */

import {
  Upload,
  ClipboardCheck,
  CheckCircle2,
  MessageSquare,
  Star,
  FolderOpen,
} from "lucide-react";

export const activityIcons: Record<string, typeof Upload> = {
  upload: Upload,
  review: ClipboardCheck,
  approval: CheckCircle2,
  comment: MessageSquare,
  create: Star,
  edit: FolderOpen,
};

export const activityColors: Record<string, string> = {
  upload: "bg-status-submitted/10 text-status-submitted",
  review: "bg-info/10 text-info",
  approval: "bg-success/10 text-success",
  comment: "bg-accent/10 text-accent",
  create: "bg-warning/10 text-warning",
  edit: "bg-status-draft/10 text-text-secondary",
};
