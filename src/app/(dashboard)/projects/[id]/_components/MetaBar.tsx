"use client";

import { useTranslations } from "next-intl";
import { Calendar, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { DbMember } from "@/types";

interface MetaBarProps {
  clientName?: string | null;
  clientEmail?: string | null;
  members: DbMember[];
  createdAt: string;
  phases: { id: string }[];
  phaseCounts: Map<string, number>;
  /** PM variant shows client/architects/created/sections. Client variant shows status/category/deadline/members. */
  variant?: "pm" | "client";
  /** Project status — used by client variant. */
  status?: string;
  /** Project category — used by client variant. */
  category?: string;
  /** Project deadline — used by client variant. */
  deadline?: string | null;
}

/** Project metadata bar — adapts display based on variant. */
export function MetaBar({
  clientName,
  clientEmail,
  members,
  createdAt,
  phases,
  phaseCounts,
  variant = "pm",
  status,
  category,
  deadline,
}: MetaBarProps) {
  const t = useTranslations("projectDetail");

  if (variant === "client") {
    return (
      <div className="px-10 py-3 flex items-center gap-6 text-[13px] border-b border-[#333333]">
        {status && (
          <div className="flex items-center gap-2">
            <span className="text-[#666666]">{t("statusLabel")}</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                status === "active"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : status === "completed"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-[#333333] text-[#A0A0A0]"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        )}
        {category && (
          <div className="flex items-center gap-2 text-[#A0A0A0]">
            <span className="text-[#666666]">Category:</span>
            <span className="capitalize">{category}</span>
          </div>
        )}
        {deadline && (
          <div className="flex items-center gap-1.5 text-[#A0A0A0]">
            <Calendar className="w-3.5 h-3.5 text-[#F5C518]" />
            {t("duePrefix")}{" "}
            {new Date(deadline).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
        {members.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Users className="w-3.5 h-3.5 text-[#666666]" />
            <div className="flex -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <Avatar
                  key={m.user_id}
                  initials={deriveInitials(m.name)}
                  color={avatarColor(m.user_id)}
                  size="sm"
                  className="w-6 h-6 text-[9px] border border-[#1A1A1A]"
                />
              ))}
              {members.length > 4 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium text-[#A0A0A0] bg-[#333333] border border-[#1A1A1A]">
                  +{members.length - 4}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // PM variant
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
