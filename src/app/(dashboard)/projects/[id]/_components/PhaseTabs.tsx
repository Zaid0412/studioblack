"use client";

import { useRef, useEffect } from "react";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { SlidingIndicator } from "@/components/ui/SlidingIndicator";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);
  const indicator = useSlidingIndicator(scrollRef, activePhaseId);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: isFirstRender.current ? "instant" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
      isFirstRender.current = false;
    }
  }, [activePhaseId]);

  return (
    <div className="relative shrink-0 px-4 lg:px-10">
      {/* Fade hints for mobile scroll — left and right */}
      <div className="pointer-events-none absolute left-4 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
      <div className="pointer-events-none absolute right-4 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 lg:hidden" />
      <div
        ref={scrollRef}
        className="relative flex rounded-xl border border-border-default overflow-x-auto scrollbar-none"
      >
        {phases.map((phase) => {
          const isActive = phase.id === activePhaseId;
          const count = phaseCounts.get(phase.id) || 0;
          return (
            <button
              key={phase.id}
              ref={isActive ? activeRef : undefined}
              data-active={isActive}
              onClick={() => onPhaseChange(phase.id)}
              className={`relative flex items-center gap-2.5 px-4 pt-3 pb-2.5 text-left transition-all duration-200 ease-out cursor-pointer
                min-w-[140px] flex-1 lg:min-w-0
                ${
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
                  className={`text-[13px] truncate transition-colors duration-200 ${
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
            </button>
          );
        })}
        {/* Accent underline — slides between phases */}
        <SlidingIndicator
          className="bottom-0 h-[3px] bg-accent"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
    </div>
  );
}
