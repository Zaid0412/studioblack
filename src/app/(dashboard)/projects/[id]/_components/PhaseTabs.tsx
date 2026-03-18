"use client";

import type { DbPhase } from "@/types";

interface PhaseTabsProps {
  phases: DbPhase[];
  activePhaseId: string | null;
  phaseCounts: Map<string, number>;
  onPhaseChange: (phaseId: string) => void;
}

/** Horizontal tabs for switching between project phases with file counts. */
export function PhaseTabs({
  phases,
  activePhaseId,
  phaseCounts,
  onPhaseChange,
}: PhaseTabsProps) {
  return (
    <div className="flex items-center px-10 border-b border-[#333333] overflow-x-auto shrink-0">
      {phases.map((phase) => {
        const isActive = phase.id === activePhaseId;
        const count = phaseCounts.get(phase.id) || 0;
        return (
          <button
            key={phase.id}
            onClick={() => onPhaseChange(phase.id)}
            className={`relative flex items-center gap-1.5 px-4 h-11 text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
              isActive
                ? "text-white font-medium"
                : "text-[#A0A0A0] font-normal hover:text-white"
            }`}
          >
            {phase.name}
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] ${
                isActive
                  ? "bg-[#333333] text-white font-medium"
                  : "bg-[#242424] text-[#666666] font-normal"
              }`}
            >
              {count}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F5C518]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
