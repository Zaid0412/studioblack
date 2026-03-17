"use client";

import { useTranslations } from "next-intl";
import type { DbMember } from "@/types";

interface MetaBarProps {
  clientName: string | null;
  clientEmail: string | null;
  members: DbMember[];
  createdAt: string;
  phases: { id: string }[];
  phaseCounts: Map<string, number>;
}

/**
 *
 */
export function MetaBar({
  clientName,
  clientEmail,
  members,
  createdAt,
  phases,
  phaseCounts,
}: MetaBarProps) {
  const t = useTranslations("projectDetail");

  const client = clientName || clientEmail || "\u2014";
  const architects =
    members
      .filter((m) => m.role === "architect")
      .map((m) => m.name)
      .join(", ") || "\u2014";
  const createdDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const designSectionCount = phases.filter(
    (p) => (phaseCounts.get(p.id) || 0) > 0
  ).length;

  return (
    <div className="px-10 py-3">
      <div className="flex items-center gap-8 rounded-[10px] bg-[#1A1A1A] border border-[#333333] px-5 py-4">
        {/* Client */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
            {t("clientLabel").replace(":", "")}
          </span>
          <span className="text-[14px] font-medium text-white">{client}</span>
        </div>
        <div className="w-px h-8 bg-[#333333]" />
        {/* Architects */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
            {t("architects") || "Architects"}
          </span>
          <span className="text-[14px] font-medium text-white">
            {architects}
          </span>
        </div>
        <div className="w-px h-8 bg-[#333333]" />
        {/* Created */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
            {t("created") || "Created"}
          </span>
          <span className="text-[14px] font-medium text-white">
            {createdDate}
          </span>
        </div>
        <div className="w-px h-8 bg-[#333333]" />
        {/* Sections count */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#666666] tracking-[0.5px] uppercase">
            {t("sections") || "Sections"}
          </span>
          <span className="text-[14px] font-medium text-white">
            {designSectionCount} {t("designSections")}
          </span>
        </div>
      </div>
    </div>
  );
}
