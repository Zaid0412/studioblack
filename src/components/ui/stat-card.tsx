import { Card } from "./card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

/**
 * Dashboard metric card displaying a label, large value, optional icon, and trend.
 *
 * The `trend` prop controls the colour of the `change` text:
 * `"up"` → green, `"down"` → red, `"neutral"` → muted.
 */
export function StatCard({ label, value, icon: Icon, change, trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="text-2xl font-bold text-text-primary">{value}</span>
          {change && (
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up" && "text-success",
                trend === "down" && "text-error",
                trend === "neutral" && "text-text-muted"
              )}
            >
              {change}
            </span>
          )}
        </div>
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
            <Icon className="w-5 h-5 text-accent" />
          </div>
        )}
      </div>
    </Card>
  );
}
