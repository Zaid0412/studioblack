"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

/** Banner shown when the project is approved/completed. */
export function CompletedBanner() {
  const t = useTranslations("projectDetail");

  return (
    <div className="px-4 lg:px-10 py-3 bg-emerald-500/5 border-b border-[#333333]">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="text-[13px] font-medium text-emerald-400">
          {t("projectApproved")}
        </span>
        <span className="text-[11px] text-[#666666]">
          — {t("projectApprovedHint")}
        </span>
      </div>
    </div>
  );
}
