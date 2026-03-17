"use client";

interface Step {
  id: string;
  name: string;
  step_order: number;
  status: string; // "pending" | "in_progress" | "completed"
}

interface WorkflowStepsProps {
  steps: Step[];
}

const dotStyle: Record<string, { dot: string; line: string; label: string }> = {
  completed: {
    dot: "w-3 h-3 rounded-full bg-[#22C55E]",
    line: "h-0 w-8 border-t border-[#333333]",
    label: "text-[11px] font-medium text-white",
  },
  in_progress: {
    dot: "w-3.5 h-3.5 rounded-full bg-[#F5C518] ring-2 ring-[#F5C518]",
    line: "h-0 w-8 border-t border-[#333333]",
    label: "text-[11px] font-semibold text-[#F5C518]",
  },
  pending: {
    dot: "w-3 h-3 rounded-full bg-[#333333]",
    line: "h-0 w-8 border-t border-[#333333]",
    label: "text-[11px] font-medium text-[#666666]",
  },
};

/** Horizontal workflow step bar — 7 steps with colored dots and connecting lines. */
export function WorkflowSteps({ steps }: WorkflowStepsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, i) => {
        const style = dotStyle[step.status] || dotStyle.pending;
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div className={style.dot} />
            <span className={style.label}>{step.name}</span>
            {i < steps.length - 1 && <div className={style.line} />}
          </div>
        );
      })}
    </div>
  );
}
