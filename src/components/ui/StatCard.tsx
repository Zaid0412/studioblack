import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional Tailwind text-color class for the value (e.g. `text-error`). */
  valueColor?: string;
  className?: string;
  /**
   * When set, renders as a `Link` to the given href and adds clickable
   * affordances (cursor, hover ring, persistent `→` indicator). Without
   * an `href` the card stays a static `<div>`.
   */
  href?: string;
}

/** Compact metric card used on dashboards. Pairs with `SkeletonCard`. */
export function StatCard({
  label,
  value,
  icon: Icon,
  valueColor,
  className,
  href,
}: Props) {
  const interactive = !!href;
  const baseClass = cn(
    "flex flex-col gap-2 rounded-xl bg-bg-elevated p-5",
    interactive &&
      "group cursor-pointer ring-1 ring-transparent hover:ring-accent/40 hover:bg-bg-elevated/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent",
    className
  );

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-muted">{label}</span>
        <Icon className="w-4 h-4 text-text-muted" />
      </div>
      <span
        className={cn(
          "text-[32px] font-bold",
          valueColor ?? "text-text-primary"
        )}
      >
        {value}
      </span>
      {interactive && (
        <ArrowRight className="self-end w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      )}
    </>
  );

  if (interactive) {
    return (
      <Link
        href={href}
        className={baseClass}
        aria-label={`${label}: ${value}. Open.`}
      >
        {content}
      </Link>
    );
  }
  return <div className={baseClass}>{content}</div>;
}
