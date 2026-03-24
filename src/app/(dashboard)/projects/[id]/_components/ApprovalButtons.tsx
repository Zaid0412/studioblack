"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface ApprovalButtonsProps {
  submittingDecision: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
}

/** Approve / Request Changes buttons shown in the client header. */
export function ApprovalButtons({
  submittingDecision,
  onApprove,
  onRequestChanges,
}: ApprovalButtonsProps) {
  const t = useTranslations("projectDetail");

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={onRequestChanges}
        disabled={submittingDecision}
        className="flex items-center gap-1.5 border border-[#F59E0B] text-[#F59E0B] rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-[#F59E0B]/10 transition-colors cursor-pointer disabled:opacity-50"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        {t("requestChanges")}
      </button>
      <button
        onClick={onApprove}
        disabled={submittingDecision}
        className="flex items-center gap-1.5 bg-[#22C55E] text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:bg-[#22C55E]/90 transition-colors cursor-pointer disabled:opacity-50"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        {submittingDecision ? t("submitting") : t("approveProject")}
      </button>
    </div>
  );
}
