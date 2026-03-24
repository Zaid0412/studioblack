"use client";

import { useTranslations } from "next-intl";
import { ClipboardCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DbPendingTask } from "@/types";

interface PendingTasksBannerProps {
  pendingTasks: DbPendingTask[];
  reviewingTaskId: string | null;
  onTaskReview: (
    taskId: string,
    action: "approved" | "changes_requested"
  ) => void;
}

/** Banner showing tasks awaiting client review with approve/reject actions. */
export function PendingTasksBanner({
  pendingTasks,
  reviewingTaskId,
  onTaskReview,
}: PendingTasksBannerProps) {
  const t = useTranslations("projectDetail");

  if (pendingTasks.length === 0) return null;

  return (
    <div className="px-10 py-3 bg-[#1A1600] border-b border-[#333333]">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="w-4 h-4 text-[#F5C518]" />
        <span className="text-[13px] font-semibold text-white">
          {t("tasksPendingReview")} ({pendingTasks.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {pendingTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-lg bg-[#0D0D0D] px-4 py-3"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[13px] font-medium text-white">
                {task.title}
              </span>
              <span className="text-[11px] text-[#666666]">
                {t("phase")}: {task.phase_name}
                {task.assigned_name && ` · By ${task.assigned_name}`}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onTaskReview(task.id, "approved")}
                disabled={reviewingTaskId === task.id}
                className="flex items-center gap-1 border border-[#22C55E] text-[#22C55E] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("approve")}
              </button>
              <button
                onClick={() => onTaskReview(task.id, "changes_requested")}
                disabled={reviewingTaskId === task.id}
                className="flex items-center gap-1 border border-[#F59E0B] text-[#F59E0B] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {t("changes")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
