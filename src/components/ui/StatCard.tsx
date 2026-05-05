import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional Tailwind text-color class for the value (e.g. `text-error`). */
  valueColor?: string;
  className?: string;
}

/** Compact metric card used on dashboards. Pairs with `SkeletonCard`. */
export function StatCard({
  label,
  value,
  icon: Icon,
  valueColor,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-bg-elevated p-5",
        className
      )}
    >
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
    </div>
  );
}
