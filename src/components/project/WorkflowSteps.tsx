"use client";

interface Step {
  id: string;
  name: string;
  step_order: number;
  status: string; // "pending" | "in_progress" | "completed"
  enabled: boolean;
}

interface WorkflowStepsProps {
  steps: Step[];
}

const dotStyle: Record<string, { dot: string; line: string; label: string }> = {
  completed: {
    dot: "w-3 h-3 rounded-full bg-success",
    line: "h-0 w-8 border-t border-border-default",
    label: "text-[11px] font-medium text-text-primary",
  },
  in_progress: {
    dot: "w-3.5 h-3.5 rounded-full bg-accent ring-2 ring-accent",
    line: "h-0 w-8 border-t border-border-default",
    label: "text-[11px] font-semibold text-accent",
  },
  pending: {
    dot: "w-3 h-3 rounded-full bg-border-default",
    line: "h-0 w-8 border-t border-border-default",
    label: "text-[11px] font-medium text-text-muted",
  },
};

/** Horizontal workflow step bar — 7 steps with colored dots and connecting lines. */
export function WorkflowSteps({ steps }: WorkflowStepsProps) {
  const visibleSteps = steps.filter((step) => step.enabled);
  return (
    <div className="flex items-center gap-1.5">
      {visibleSteps.map((step, i) => {
        const style = dotStyle[step.status] || dotStyle.pending;
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div className={style.dot} />
            <span className={style.label}>{step.name}</span>
            {i < visibleSteps.length - 1 && <div className={style.line} />}
          </div>
        );
      })}
    </div>
  );
}
