"use client";

import { useState } from "react";
import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}

/**
 * 5-star half-step rating picker.
 *
 * Each star has two clickable halves (left = half, right = full) so the user
 * can pick any value in 0.5 increments without dragging or extra controls.
 * Read-only mode renders the same shapes without hover or interaction.
 */
export function VendorRatingPicker({
  value,
  onChange,
  readOnly,
  size = "md",
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  const interactive = !readOnly && !!onChange;

  const px = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div
      className={cn("inline-flex items-center", gap)}
      onMouseLeave={() => setHover(null)}
      role={interactive ? "slider" : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 5 : undefined}
      aria-valuenow={interactive ? value : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = display >= i;
        const half = !filled && display >= i - 0.5;
        return (
          <span key={i} className="relative inline-flex">
            {filled ? (
              <Star className={cn(px, "fill-warning text-warning")} />
            ) : half ? (
              <StarHalf className={cn(px, "fill-warning text-warning")} />
            ) : (
              <Star className={cn(px, "text-text-muted")} />
            )}
            {interactive && (
              <>
                <button
                  type="button"
                  aria-label={`${i - 0.5} stars`}
                  onMouseEnter={() => setHover(i - 0.5)}
                  onClick={() => onChange?.(i - 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                />
                <button
                  type="button"
                  aria-label={`${i} stars`}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onChange?.(i)}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                />
              </>
            )}
          </span>
        );
      })}
      <span
        className={cn(
          "ml-2 text-text-muted",
          size === "sm" ? "text-[11px]" : "text-xs"
        )}
      >
        {display.toFixed(1)}
      </span>
    </div>
  );
}
