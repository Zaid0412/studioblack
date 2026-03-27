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
    <div className="relative border-b border-border-default shrink-0">
      {/* Right fade hint */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
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
                    ? "text-accent font-medium"
                    : "text-text-primary font-medium"
                  : "text-text-secondary font-normal hover:text-text-primary"
              }`}
            >
              {showPhaseStatus && (
                <>
                  {phase.status === "completed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : phase.status === "in_progress" ? (
                    <Clock className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-text-muted" />
                  )}
                </>
              )}
              {phase.name}
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] ${
                  isActive
                    ? "bg-border-default text-text-primary font-medium"
                    : "bg-bg-elevated text-text-muted font-normal"
                }`}
              >
                {count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
