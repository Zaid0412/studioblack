import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "muted" | "success" | "accent" | "danger";

const TONE_CLASS: Record<KpiTone, string> = {
  muted: "text-text-muted",
  success: "text-success",
  accent: "text-accent-strong",
  danger: "text-error",
};

interface KpiCardProps {
  label: string;
  /** Pre-formatted value (money/count/etc). */
  value: string;
  icon: LucideIcon;
  sub?: string;
  subTone?: KpiTone;
  /** When set, the tile becomes a link to the matching tab (nav-hub behaviour). */
  href?: string;
}

/** One metric tile in the Overview KPI row. Links to its tab when `href` is set. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  subTone = "muted",
  href,
}: KpiCardProps) {
  const className = cn(
    "flex flex-col gap-2 rounded-xl border border-border-default bg-bg-secondary p-4",
    href &&
      "cursor-pointer outline-none transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-strong/50 hover:bg-bg-elevated/40 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:hover:translate-y-0"
  );
  const content = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
