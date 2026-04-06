"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { sortPinsByDate, isPinned, buildPinIndexMap } from "@/lib/pinUtils";
import type { DbPinComment } from "@/types";

interface PinOverlayProps {
  pins: DbPinComment[];
  page: number;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  /** Temporary pin shown while the user is typing a comment. */
  pendingPin?: { xPercent: number; yPercent: number; page: number } | null;
  /** Callback when a pin is dragged to a new position. */
  onRepositionPin?: (
    pinId: string,
    xPercent: number,
    yPercent: number,
    page: number
  ) => void;
  /** Whether pin-place mode is active — disables drag when true. */
  pinMode?: boolean;
  /** Current user ID — only the author can drag their own pin. */
  currentUserId?: string;
  /** Callback when the pending pin is dragged to a new position. */
  onRepositionPendingPin?: (xPercent: number, yPercent: number) => void;
}

/** Minimum pixels of movement before a click becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Sentinel ID used for the pending (unsaved) pin in drag state. */
const PENDING_ID = "__pending__";

/**
 * MapPin-shaped marker using the Lucide MapPin silhouette.
 * Anchor point is the bottom tip.
 */
function PinMarker({
  label,
  selected,
  resolved,
  pulsing,
  dragging,
}: {
  label: React.ReactNode;
  selected?: boolean;
  resolved?: boolean;
  pulsing?: boolean;
  dragging?: boolean;
}) {
  const fill = selected ? "#F5C518" : resolved ? "#444" : "#dc2626";

  const stroke = selected ? "#d4a910" : resolved ? "#333" : "#991b1b";

  return (
    <div
      className={`relative flex flex-col items-center ${pulsing ? "animate-pulse" : ""}`}
    >
      {/* Glow when selected */}
      {selected && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-[#F5C518]/25 blur-sm" />
      )}
      {/* Lucide MapPin silhouette */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        className={`drop-shadow-md transition-transform ${dragging ? "scale-125" : ""}`}
      >
        {/* Outer pin shape (Lucide MapPin path) */}
        <path
          d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
        />
        {/* Inner circle — darker background for the label */}
        <circle
          cx="12"
          cy="10"
          r="5"
          fill={
            selected ? "#0D0D0D" : resolved ? "#2A2A2A" : "rgba(0,0,0,0.35)"
          }
        />
      </svg>
      {/* Label overlaid on the inner circle */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ paddingBottom: 8 }}
      >
        <span
          className={`text-[10px] font-bold leading-none ${
            selected
              ? "text-accent"
              : resolved
                ? "text-text-muted"
                : "text-white"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** Renders pin-shaped markers positioned absolutely over a document page. */
export function PinOverlay({
  pins,
  page,
  selectedPinId,
  onSelectPin,
  pendingPin,
  onRepositionPin,
  pinMode = false,
  currentUserId,
  onRepositionPendingPin,
}: PinOverlayProps) {
  const [dragState, setDragState] = useState<{
    pinId: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    /** Current drag position as percentages (computed in event handlers). */
    leftPercent: number;
    topPercent: number;
  } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef(dragState);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const pagePins = sortPinsByDate(
    pins.filter((p) => isPinned(p) && p.page === page)
  );

  const indexMap = buildPinIndexMap(pins);
  const pinnedCount = pins.filter(isPinned).length;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, pin: DbPinComment) => {
      // Only the author can drag their own pin
      if (pinMode || !onRepositionPin) return;
      if (currentUserId && pin.user_id !== currentUserId) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragState({
        pinId: pin.id,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        leftPercent: pin.x_percent!,
        topPercent: pin.y_percent!,
      });
    },
    [pinMode, onRepositionPin, currentUserId]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds || !overlayRef.current) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const moved = Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD;
    const rect = overlayRef.current.getBoundingClientRect();
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            isDragging: prev.isDragging || moved,
            leftPercent: Math.max(
              0,
              Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
            ),
            topPercent: Math.max(
              0,
              Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
            ),
          }
        : null
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    const ds = dragStateRef.current;
    if (!ds) return;

    if (ds.isDragging) {
      if (ds.pinId === PENDING_ID) {
        onRepositionPendingPin?.(ds.leftPercent, ds.topPercent);
      } else {
        onRepositionPin?.(ds.pinId, ds.leftPercent, ds.topPercent, page);
      }
    } else if (ds.pinId !== PENDING_ID) {
      // It was a click, not a drag
      onSelectPin(ds.pinId);
    }

    setDragState(null);
  }, [onRepositionPin, onRepositionPendingPin, onSelectPin, page]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-10"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pagePins.map((pin) => {
        const index = indexMap.get(pin.id) ?? 0;
        const isSelected = pin.id === selectedPinId;
        const isDragging = dragState?.pinId === pin.id && dragState.isDragging;
        const pos = isDragging
          ? { left: dragState.leftPercent, top: dragState.topPercent }
          : { left: pin.x_percent!, top: pin.y_percent! };
        const canDrag = currentUserId ? pin.user_id === currentUserId : true;

        return (
          <div
            key={pin.id}
            onPointerDown={(e) => handlePointerDown(e, pin)}
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              transform: "translate(-50%, -100%)",
            }}
            className={`absolute pointer-events-auto transition-transform duration-200 ease-out will-change-transform ${
              isDragging
                ? "cursor-grabbing z-20"
                : canDrag && !pinMode
                  ? "cursor-pointer hover:scale-110"
                  : "cursor-pointer"
            }`}
          >
            <PinMarker
              label={pin.resolved ? <Check className="w-3 h-3" /> : index}
              selected={isSelected}
              resolved={pin.resolved}
              dragging={isDragging}
            />
          </div>
        );
      })}

      {/* Pending pin — draggable while user types the comment */}
      {pendingPin &&
        pendingPin.page === page &&
        (() => {
          const isPendingDragging =
            dragState?.pinId === PENDING_ID && dragState.isDragging;
          const pendingPos = isPendingDragging
            ? { left: dragState.leftPercent, top: dragState.topPercent }
            : { left: pendingPin.xPercent, top: pendingPin.yPercent };
          return (
            <div
              onPointerDown={(e) => {
                if (!onRepositionPendingPin) return;
                e.preventDefault();
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                setDragState({
                  pinId: PENDING_ID,
                  startX: e.clientX,
                  startY: e.clientY,
                  isDragging: false,
                  leftPercent: pendingPin.xPercent,
                  topPercent: pendingPin.yPercent,
                });
              }}
              style={{
                left: `${pendingPos.left}%`,
                top: `${pendingPos.top}%`,
                transform: "translate(-50%, -100%)",
              }}
              className={`absolute pointer-events-auto transition-transform duration-200 ease-out will-change-transform ${
                isPendingDragging
                  ? "cursor-grabbing z-20"
                  : "cursor-grab hover:scale-110"
              }`}
            >
              <PinMarker
                label={pinnedCount + 1}
                selected
                pulsing={!isPendingDragging}
                dragging={isPendingDragging}
              />
            </div>
          );
        })()}
    </div>
  );
}
