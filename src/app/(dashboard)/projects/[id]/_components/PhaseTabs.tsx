"use client";

import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { DbPhase } from "@/types";

interface PhaseTabsProps {
  phases: DbPhase[];
  activePhaseId: string | null;
  phaseCounts: Map<string, number>;
  onPhaseChange: (phaseId: string) => void;
  /** When true, shows status icons next to phase names (used in client view). */
  showPhaseStatus?: boolean;
}

/** Horizontal tabs for switching between project phases with file counts. */
export function PhaseTabs({
  phases,
  activePhaseId,
  phaseCounts,
  onPhaseChange,
  showPhaseStatus = false,
}: PhaseTabsProps) {
  return (
    <div className="relative border-b border-[#333333] shrink-0">
      {/* Right fade hint */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0d0d0d] to-transparent z-10 lg:hidden" />
      <div className="flex items-center px-4 lg:px-10 overflow-x-auto scrollbar-none">
        {phases.map((phase) => {
          const isActive = phase.id === activePhaseId;
          const count = phaseCounts.get(phase.id) || 0;
          return (
            <button
              key={phase.id}
              onClick={() => onPhaseChange(phase.id)}
              className={`relative flex items-center gap-1.5 px-4 h-11 text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? showPhaseStatus
                    ? "text-[#F5C518] font-medium"
                    : "text-white font-medium"
                  : "text-[#A0A0A0] font-normal hover:text-white"
              }`}
            >
              {showPhaseStatus && (
                <>
                  {phase.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : phase.status === "in_progress" ? (
                    <Clock className="w-3.5 h-3.5 text-[#F5C518]" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-[#666666]" />
                  )}
                </>
              )}
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
    </div>
  );
}
