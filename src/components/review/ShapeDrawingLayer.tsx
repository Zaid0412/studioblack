"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PinShape, PinShapeType } from "@/types";
import { simplifyPath } from "@/lib/shapeUtils";

/** Minimum smaller-dimension extent (percent) before we accept a drawing. */
const MIN_EXTENT_PCT = 1.5;

/** Epsilon for freehand path simplification, in percent units. */
const RDP_EPSILON = 0.2;

interface ShapeDrawingLayerProps {
  page: number;
  tool: PinShapeType;
  color: string;
  /** Stroke thickness in screen pixels for the live preview (defaults to 2). */
  strokeWidth?: number;
  /** Preview opacity 0–1 (defaults to 1). */
  opacity?: number;
  /** When true, fill the preview interior with `color`. */
  fill?: boolean;
  onComplete: (shape: PinShape, page: number) => void;
  /** Called when the user cancels a drag (e.g. tiny accidental click). */
  onDismiss?: () => void;
}

/**
 * Captures pointer events on top of a document page when a shape tool is
 * active. Renders the in-progress shape live, and emits the finished shape on
 * pointerup (or discards it if below the minimum extent).
 */
export function ShapeDrawingLayer({
  page,
  tool,
  color,
  strokeWidth = 2,
  opacity = 1,
  fill = false,
  onComplete,
  onDismiss,
}: ShapeDrawingLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [current, setCurrent] = useState<[number, number] | null>(null);
  const [points, setPoints] = useState<Array<[number, number]>>([]);

  const toPct = useCallback(
    (e: React.PointerEvent): [number, number] | null => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      const x = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
      );
      const y = Math.max(
        0,
        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
      );
      return [x, y];
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const pt = toPct(e);
    if (!pt) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setStart(pt);
    setCurrent(pt);
    if (tool === "freehand") setPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!start) return;
    const pt = toPct(e);
    if (!pt) return;
    setCurrent(pt);
    if (tool === "freehand") setPoints((prev) => [...prev, pt]);
  };

  const cancel = useCallback(() => {
    setStart(null);
    setCurrent(null);
    setPoints([]);
  }, []);

  const handlePointerUp = () => {
    if (!start || !current) {
      cancel();
      return;
    }

    // Style stamped onto every shape this layer emits — captured here so it
    // travels with the geometry into the pending list / API.
    const style = {
      color,
      strokeWidth,
      opacity,
      fill,
    } as const;

    let shape: PinShape | null = null;
    if (tool === "rectangle") {
      const x = Math.min(start[0], current[0]);
      const y = Math.min(start[1], current[1]);
      const w = Math.abs(current[0] - start[0]);
      const h = Math.abs(current[1] - start[1]);
      // Accept as long as the user actually dragged in some direction — a flat
      // rectangle is still intentional, only a pure click should be dropped.
      if (Math.max(w, h) >= MIN_EXTENT_PCT) {
        shape = { type: "rectangle", x, y, w, h, ...style };
      }
    } else if (tool === "circle") {
      const cx = (start[0] + current[0]) / 2;
      const cy = (start[1] + current[1]) / 2;
      const rx = Math.abs(current[0] - start[0]) / 2;
      const ry = Math.abs(current[1] - start[1]) / 2;
      if (Math.max(rx * 2, ry * 2) >= MIN_EXTENT_PCT) {
        shape = { type: "circle", cx, cy, rx, ry, ...style };
      }
    } else {
      if (points.length >= 2) {
        const simplified = simplifyPath(points, RDP_EPSILON);
        if (simplified.length >= 2) {
          shape = {
            type: "freehand",
            points: simplified.map(([x, y]) => [x, y] as [number, number]),
            ...style,
          };
        }
      }
    }

    cancel();
    if (shape) onComplete(shape, page);
    else onDismiss?.();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  // ── Live preview ─────────────────────────────────────────────────────
  let preview: React.ReactNode = null;
  if (start && current) {
    const previewFill = fill && tool !== "freehand" ? color : "none";
    const common = {
      stroke: color,
      strokeWidth,
      fill: previewFill,
      vectorEffect: "non-scaling-stroke" as const,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      strokeDasharray: "0.6 0.4",
      opacity,
    };
    if (tool === "rectangle") {
      const x = Math.min(start[0], current[0]);
      const y = Math.min(start[1], current[1]);
      const w = Math.abs(current[0] - start[0]);
      const h = Math.abs(current[1] - start[1]);
      preview = <rect x={x} y={y} width={w} height={h} {...common} />;
    } else if (tool === "circle") {
      const cx = (start[0] + current[0]) / 2;
      const cy = (start[1] + current[1]) / 2;
      const rx = Math.abs(current[0] - start[0]) / 2;
      const ry = Math.abs(current[1] - start[1]) / 2;
      preview = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} />;
    } else if (points.length >= 2) {
      const d =
        "M " +
        points
          .map(([px, py], i) => (i === 0 ? `${px} ${py}` : `L ${px} ${py}`))
          .join(" ");
      preview = <path d={d} {...common} strokeDasharray={undefined} />;
    }
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-20"
      style={{ cursor: "crosshair", touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {preview && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {preview}
        </svg>
      )}
    </div>
  );
}
