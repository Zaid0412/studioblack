"use client";

import { Check } from "lucide-react";
import type { DbPinComment } from "@/types";

interface PinOverlayProps {
  pins: DbPinComment[];
  page: number;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  /** Temporary pin shown while the user is typing a comment. */
  pendingPin?: { xPercent: number; yPercent: number; page: number } | null;
}

/** Compact circular pin marker. Anchor point is bottom-center (the tail tip). */
function PinMarker({
  label,
  selected,
  resolved,
  pulsing,
}: {
  label: React.ReactNode;
  selected?: boolean;
  resolved?: boolean;
  pulsing?: boolean;
}) {
  return (
    <div className={`relative flex flex-col items-center ${pulsing ? "animate-pulse" : ""}`}>
      {/* Outer glow ring when selected */}
      {selected && (
        <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[30px] h-[30px] rounded-full bg-[#F5C518]/20 blur-[2px]" />
      )}
      {/* Circle body */}
      <div
        className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border-[1.5px] ${
          selected
            ? "bg-[#F5C518] border-[#F5C518] text-[#0D0D0D] shadow-[0_0_8px_rgba(245,197,24,0.5)]"
            : resolved
              ? "bg-[#2A2A2A] border-[#444] text-[#666]"
              : "bg-[#1A1A1A] border-[#555] text-white"
        }`}
      >
        {label}
      </div>
      {/* Tail / pointer */}
      <div
        className={`w-0 h-0 -mt-[1px] border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${
          selected
            ? "border-t-[#F5C518]"
            : resolved
              ? "border-t-[#2A2A2A]"
              : "border-t-[#1A1A1A]"
        }`}
      />
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
}: PinOverlayProps) {
  const pagePins = pins
    .filter(
      (p) =>
        p.page !== null &&
        p.x_percent !== null &&
        p.y_percent !== null &&
        p.page === page
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Build a global index map (1-based, ordered by created_at) — only pinned comments
  const pinnedAll = [...pins]
    .filter(
      (p) => p.page !== null && p.x_percent !== null && p.y_percent !== null
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  const indexMap = new Map(pinnedAll.map((p, i) => [p.id, i + 1]));
  const pinnedCount = pinnedAll.length;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {pagePins.map((pin) => {
        const index = indexMap.get(pin.id) ?? 0;
        const isSelected = pin.id === selectedPinId;

        return (
          <button
            key={pin.id}
            onClick={() => onSelectPin(pin.id)}
            style={{
              left: `${pin.x_percent}%`,
              top: `${pin.y_percent}%`,
              transform: "translate(-50%, -100%)",
            }}
            className="absolute pointer-events-auto cursor-pointer transition-transform hover:scale-110"
          >
            <PinMarker
              label={pin.resolved ? <Check className="w-3 h-3" /> : index}
              selected={isSelected}
              resolved={pin.resolved}
            />
          </button>
        );
      })}

      {/* Pending pin — pulsing while user types the comment */}
      {pendingPin && pendingPin.page === page && (
        <div
          style={{
            left: `${pendingPin.xPercent}%`,
            top: `${pendingPin.yPercent}%`,
            transform: "translate(-50%, -100%)",
          }}
          className="absolute"
        >
          <PinMarker
            label={pinnedCount + 1}
            selected
            pulsing
          />
        </div>
      )}
    </div>
  );
}
