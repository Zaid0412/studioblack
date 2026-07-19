import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "muted" | "success" | "accent" | "danger";

const TONE_CLASS: Record<KpiTone, string> = {
  muted: "text-text-muted",
  success: "text-success",
  accent: "text-accent",
  danger: "text-error",
};

interface KpiCardProps {
  label: string;
  /** Pre-formatted value (money/count/etc). */
  value: string;
  icon: LucideIcon;
  sub?: string;
  subTone?: KpiTone;
}

/** One metric tile in the Overview KPI row. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  subTone = "muted",
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-secondary p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />
      </div>
      <span className="text-2xl font-semibold leading-none text-text-primary">
        {value}
      </span>
      {sub && (
        <span className={cn("text-xs font-medium", TONE_CLASS[subTone])}>
          {sub}
        </span>
      )}
    </div>
  );
}
