"use client";

import type { DbPhase } from "@/types";

interface PhaseTabsProps {
  phases: DbPhase[];
  activePhaseId: string | null;
  phaseCounts: Map<string, number>;
  onPhaseChange: (phaseId: string) => void;
  /** When true, shows status dots next to phase names (used in client view). */
  showPhaseStatus?: boolean;
}

function statusDotColor(status: string | undefined, fileCount: number) {
  if (status === "completed") return "bg-emerald-500";
  if (fileCount > 0) return "bg-accent";
  return "bg-text-muted";
}

/** Flat underline tabs for switching between project phases with status dots and file counts. */
export function PhaseTabs({
  phases,
  activePhaseId,
  phaseCounts,
  onPhaseChange,
  showPhaseStatus = false,
}: PhaseTabsProps) {
  return (
    <div className="relative shrink-0 px-4 lg:px-10">
      {/* Right fade hint for mobile scroll */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
      <div className="flex rounded-xl border border-border-default overflow-x-auto overflow-hidden scrollbar-none">
        {phases.map((phase, idx) => {
          const isActive = phase.id === activePhaseId;
          const count = phaseCounts.get(phase.id) || 0;
          const isFirst = idx === 0;
          const isLast = idx === phases.length - 1;
          return (
            <button
              key={phase.id}
              onClick={() => onPhaseChange(phase.id)}
              className={`relative flex-1 flex items-center gap-2.5 px-4 pt-3 pb-2.5 text-left transition-all duration-200 ease-out cursor-pointer shrink-0 min-w-0 ${
                isActive
                  ? "bg-accent/10"
                  : "bg-transparent hover:bg-bg-elevated"
              }`}
            >
              {showPhaseStatus && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${statusDotColor(phase.status, count)}`}
                />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className={`text-[13px] whitespace-nowrap transition-colors duration-200 ${
                    isActive
                      ? "text-text-primary font-semibold"
                      : "text-text-secondary font-medium"
                  }`}
                >
                  {phase.name}
                </span>
                <span
                  className={`text-[10px] transition-colors duration-200 ${
                    isActive ? "text-text-secondary" : "text-text-muted"
                  }`}
                >
                  {count} file{count !== 1 ? "s" : ""}
                </span>
              </div>
              {/* Accent underline — always rendered, fades in/out */}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[3px] bg-accent transition-opacity duration-200 ease-out ${
                  isFirst ? "rounded-bl-xl" : ""
                } ${isLast ? "rounded-br-xl" : ""} ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
