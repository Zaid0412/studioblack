"use client";

import { useTranslations } from "next-intl";
import { History, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DbApproval } from "@/types";

interface ApprovalHistoryProps {
  approvals: DbApproval[];
}

/** Timeline of project approval decisions. */
export function ApprovalHistory({ approvals }: ApprovalHistoryProps) {
  const t = useTranslations("projectDetail");

  if (approvals.length === 0) return null;

  return (
    <div className="px-4 lg:px-10 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-text-muted" />
        <span className="text-[13px] font-semibold text-text-primary">
          {t("approvalHistory")}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {approvals.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg bg-bg-secondary border border-border-default px-4 py-3"
          >
            {a.decision === "approved" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
            )}
            <div className="flex flex-col flex-1">
              <span className="text-[13px] text-text-secondary">
                <span className="font-medium text-text-primary">
                  {a.user_name}
                </span>{" "}
                {a.decision === "approved"
                  ? t("approvedProject")
                  : t("requestedChanges")}
              </span>
              {a.comment && (
                <span className="text-[11px] text-text-muted">{a.comment}</span>
              )}
            </div>
            <span className="text-[11px] text-text-muted shrink-0">
              {new Date(a.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
