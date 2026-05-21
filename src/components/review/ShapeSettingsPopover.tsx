"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { PinShapeType } from "@/types";

/** Six-swatch palette offered for shape annotations — design-system tokens. */
export const SHAPE_COLORS = [
  "#dc2626", // red
  "#ea580c", // orange
  "#16a34a", // green
  "#0284c7", // blue
  "#7c3aed", // purple
  "#f5c518", // yellow
] as const;

/** Stroke thickness presets in screen pixels. */
const STROKE_PRESETS = [1, 2, 4] as const;

const TOOL_LABEL: Record<PinShapeType, string> = {
  rectangle: "Rectangle",
  circle: "Circle",
  freehand: "Pen",
};

interface ShapeSettingsPopoverProps {
  /** Tool whose settings are being edited. Drives the popover header label. */
  tool: PinShapeType;
  /** Whether the parent toolbar button is currently active. */
  active: boolean;
  /** Toggle the tool on/off. Pop-up opens automatically when active. */
  onToggle: () => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  fill: boolean;
  onFillChange: (fill: boolean) => void;
  /** Which side of the trigger the popover opens from. Defaults to "bottom". */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment on the cross axis. Defaults to "end". */
  align?: "start" | "center" | "end";
  /** Toolbar button (icon) rendered as the popover trigger. */
  children: React.ReactNode;
}

/**
 * Settings popover for a shape draw tool. Opens automatically while the tool
 * is active. Holds color, stroke width, opacity, and the fill toggle.
 */
export function ShapeSettingsPopover({
  tool,
  active,
  onToggle,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  opacity,
  onOpacityChange,
  fill,
  onFillChange,
  side = "bottom",
  align = "end",
  children,
}: ShapeSettingsPopoverProps) {
  // Popover and tool-selection are independent. The popover opens whenever the
  // tool becomes active, but the user can dismiss the popover (by clicking
  // outside or pressing Esc) without deactivating the tool — so they can
  // actually draw on the canvas with the chosen settings.
  const [popoverOpen, setPopoverOpen] = useState(active);
  useEffect(() => {
    setPopoverOpen(active);
  }, [active]);

  const opacityPct = Math.round(opacity * 100);

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <span onClick={onToggle}>{children}</span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-[260px] p-3 bg-bg-elevated border-border-default text-text-primary"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">
              {TOOL_LABEL[tool]}
            </span>
            <span className="text-[10px] text-text-muted">Esc</span>
          </div>

          <Section label="Color">
            <div className="flex items-center gap-2">
              {SHAPE_COLORS.map((c) => {
                const isActive = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => onColorChange(c)}
                    className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${isActive ? "ring-2 ring-offset-2 ring-offset-bg-elevated scale-110" : "hover:scale-110"}`}
                    style={{
                      backgroundColor: c,
                      boxShadow: isActive ? `0 0 0 1px ${c}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </Section>

          <Section label="Stroke">
            <div className="flex items-center gap-2">
              {STROKE_PRESETS.map((w) => {
                const isActive = w === strokeWidth;
                return (
                  <button
                    key={w}
                    type="button"
                    aria-label={`Stroke ${w}px`}
                    onClick={() => onStrokeWidthChange(w)}
                    className={`flex-1 h-7 rounded cursor-pointer flex items-center justify-center transition-colors ${isActive ? "bg-accent" : "bg-bg-input hover:bg-bg-input/80"}`}
                  >
                    <span
                      className={`block w-5 rounded-full ${isActive ? "bg-text-on-accent" : "bg-text-primary"}`}
                      style={{ height: w }}
                    />
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            label="Opacity"
            trailing={
              <span className="text-[11px] text-text-secondary">
                {opacityPct}%
              </span>
            }
          >
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={opacityPct}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              className="w-full accent-accent cursor-pointer"
            />
          </Section>

          {tool !== "freehand" && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-secondary">
                Fill shape
              </span>
              <Checkbox
                checked={fill}
                onCheckedChange={(v: boolean) => onFillChange(v)}
                label=""
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wide text-text-muted uppercase">
          {label}
        </span>
        {trailing}
      </div>
      {children}
    </div>
  );
}
