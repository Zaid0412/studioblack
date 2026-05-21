"use client";

import { Circle, MapPin, Pencil, Square } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { DrawTool } from "@/hooks/usePinComments";
import { ShapeSettingsPopover } from "./ShapeSettingsPopover";

interface AnnotationRailProps {
  pinModeActive: boolean;
  onTogglePinMode: () => void;
  drawTool: DrawTool;
  onSelectDrawTool: (tool: DrawTool) => void;
  drawColor: string;
  onSelectDrawColor: (color: string) => void;
  drawStrokeWidth: number;
  onSelectDrawStrokeWidth: (width: number) => void;
  drawOpacity: number;
  onSelectDrawOpacity: (opacity: number) => void;
  drawFill: boolean;
  onSelectDrawFill: (fill: boolean) => void;
  /**
   * Hide shape draw tools (e.g. spreadsheet viewer can't host shapes). The
   * pin button stays available because click-to-pin works on every viewer.
   */
  hideShapeTools?: boolean;
}

const SHAPE_TOOLS: Array<{
  tool: "rectangle" | "circle" | "freehand";
  label: string;
  Icon: LucideIcon;
}> = [
  { tool: "rectangle", label: "Rectangle", Icon: Square },
  { tool: "circle", label: "Circle", Icon: Circle },
  { tool: "freehand", label: "Freehand pen", Icon: Pencil },
];

/**
 * Vertical annotation toolbox docked to the left of the document. Holds the
 * pin tool and the three shape tools — each shape tool opens its settings
 * popover (color, stroke, opacity, fill) on the right edge.
 */
export function AnnotationRail({
  pinModeActive,
  onTogglePinMode,
  drawTool,
  onSelectDrawTool,
  drawColor,
  onSelectDrawColor,
  drawStrokeWidth,
  onSelectDrawStrokeWidth,
  drawOpacity,
  onSelectDrawOpacity,
  drawFill,
  onSelectDrawFill,
  hideShapeTools = false,
}: AnnotationRailProps) {
  return (
    <div className="w-12 shrink-0 bg-bg-secondary border-r border-border-default flex flex-col items-center py-3 gap-1">
      <RailButton
        active={pinModeActive}
        label="Pin comment"
        onClick={onTogglePinMode}
      >
        <MapPin className="w-4 h-4" />
      </RailButton>

      {!hideShapeTools && (
        <>
          <div className="w-6 my-1 border-t border-border-default" />
          {SHAPE_TOOLS.map(({ tool, label, Icon }) => (
            <ShapeSettingsPopover
              key={tool}
              tool={tool}
              active={drawTool === tool}
              onToggle={() => onSelectDrawTool(drawTool === tool ? null : tool)}
              color={drawColor}
              onColorChange={onSelectDrawColor}
              strokeWidth={drawStrokeWidth}
              onStrokeWidthChange={onSelectDrawStrokeWidth}
              opacity={drawOpacity}
              onOpacityChange={onSelectDrawOpacity}
              fill={drawFill}
              onFillChange={onSelectDrawFill}
              side="right"
              align="start"
            >
              <RailButton active={drawTool === tool} label={label}>
                <Icon className="w-4 h-4" />
              </RailButton>
            </ShapeSettingsPopover>
          ))}
        </>
      )}
    </div>
  );
}

function RailButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  /** Optional — when the button is wrapped by a popover that owns the click handler. */
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className={`w-8 h-8 rounded-md flex items-center justify-center cursor-pointer transition-colors ${active ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
