"use client";

import { cn } from "@/lib/utils";
import { DIMENSION_UNITS, type DimensionUnit } from "../_lib/formatters";

interface BoqDimensionUnitToggleProps {
  value: DimensionUnit;
  onChange: (next: DimensionUnit) => void;
  disabled?: boolean;
  className?: string;
}

/** Segmented `m | ft` switch used in the drawer + create sheet dimensions blocks. */
export function BoqDimensionUnitToggle({
  value,
  onChange,
  disabled,
  className,
}: BoqDimensionUnitToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Dimension unit"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border-default bg-bg-input p-0.5",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {DIMENSION_UNITS.map((unit) => {
        const active = unit === value;
        return (
          <button
            key={unit}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(unit);
            }}
            className={cn(
              "rounded px-3 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer",
              active
                ? "bg-accent text-bg-primary"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {unit}
          </button>
        );
      })}
    </div>
  );
}
