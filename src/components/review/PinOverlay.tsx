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

/** A map-style pin marker with a number or icon inside. Anchor point is the pin tip (bottom center). */
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
  const fill = selected
    ? "#F5C518"
    : resolved
      ? "#444444"
      : "#1A1A1A";
  const stroke = selected
    ? "#F5C518"
    : resolved
      ? "#555555"
      : "#A0A0A0";

  return (
    <div className={`relative flex flex-col items-center ${pulsing ? "animate-pulse" : ""}`}>
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-lg ${selected ? "drop-shadow-[0_0_6px_rgba(245,197,24,0.4)]" : ""}`}
      >
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 8.5 14 22 14 22s14-13.5 14-22C28 6.268 21.732 0 14 0Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        {/* White/dark circle for the number */}
        <circle
          cx="14"
          cy="13"
          r="8"
          fill={selected ? "#0D0D0D" : resolved ? "#333333" : "#0D0D0D"}
          opacity={resolved ? 0.5 : 0.3}
        />
      </svg>
      {/* Number/icon centered in the pin head */}
      <span
        className={`absolute top-[5px] left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 text-[10px] font-bold ${
          selected
            ? "text-[#0D0D0D]"
            : resolved
              ? "text-[#777]"
              : "text-white"
        }`}
      >
        {label}
      </span>
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
    .filter((p) => p.page === page)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Build a global index map (1-based, ordered by created_at across all pages)
  const sortedAll = [...pins].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const indexMap = new Map(sortedAll.map((p, i) => [p.id, i + 1]));

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
            label={pins.length + 1}
            selected
            pulsing
          />
        </div>
      )}
    </div>
  );
}
