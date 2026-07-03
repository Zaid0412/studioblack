"use client";

import { GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Small "Rev N" pill for a revised RFQ; renders nothing for an original (rev 0). */
export function RfqRevisionBadge({
  revisionNumber,
  className,
}: {
  revisionNumber: number;
  className?: string;
}) {
  const t = useTranslations("rfq");
  if (revisionNumber <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border-default bg-bg-elevated px-2 py-0.5 text-[11px] font-semibold text-text-secondary",
        className
      )}
    >
      <GitBranch className="w-3 h-3" />
      {t("timeline.revPill", { rev: revisionNumber })}
    </span>
  );
}
