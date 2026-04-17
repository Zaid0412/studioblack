"use client";

import { useTranslations } from "next-intl";
import { Calendar, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { formatDate } from "@/lib/formatDate";
import type { DbMember } from "@/types";

interface MetaBarProps {
  clientName?: string | null;
  clientEmail?: string | null;
  members: DbMember[];
  createdAt: string;
  phases?: { id: string }[];
  phaseCounts?: Map<string, number>;
  /** PM variant shows client/architects/created/location/sections. Client variant shows status/category/deadline/members. */
  variant?: "pm" | "client";
  /** Project status — used by client variant. */
  status?: string;
  /** Project category — used by client variant. */
  category?: string;
  /** Project deadline — used by client variant. */
  deadline?: string | null;
  /** Project scope fields. */
  scope?: string | null;
  areaSqft?: number | null;
  estimationInr?: number | null;
  /** Project location fields. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

/** Project metadata bar — adapts display based on variant. */
export function MetaBar({
  clientName,
  clientEmail,
  members,
  createdAt,
  variant = "pm",
  status,
  category,
  deadline,
  scope,
  areaSqft,
  estimationInr,
  address,
  city,
  state,
}: MetaBarProps) {
  const t = useTranslations("projectDetail");

  if (variant === "client") {
    return (
      <div className="px-4 lg:px-10 py-3 flex items-center gap-4 lg:gap-6 text-[13px] border-b border-border-default flex-wrap">
        {status && (
          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">{t("statusLabel")}</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                status === "active"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : status === "completed"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-border-default text-text-secondary"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        )}
        {category && (
          <div className="flex items-center gap-2 text-text-primary font-medium">
            <span className="text-text-secondary font-medium">Category:</span>
            <span className="capitalize">{category}</span>
          </div>
        )}
        {deadline && (
          <div className="flex items-center gap-1.5 text-text-primary font-medium">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            {t("duePrefix")} {formatDate(deadline)}
          </div>
        )}
        {members.length > 0 && (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2 ml-auto">
              <Users className="w-3.5 h-3.5 text-text-muted" />
              <div className="flex -space-x-1.5">
                {members.slice(0, 4).map((m) => (
                  <Tooltip key={m.user_id}>
                    <TooltipTrigger asChild>
                      <span>
                        <Avatar
                          initials={deriveInitials(m.name)}
                          color={avatarColor(m.user_id)}
                          size="sm"
                          className="w-6 h-6 text-[9px] border border-bg-secondary"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {m.email}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {members.length > 4 && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium text-text-secondary bg-border-default border border-bg-secondary">
                    +{members.length - 4}
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>
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
  const createdDate = formatDate(createdAt);
  return (
    <div className="px-4 lg:px-10 py-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-0 rounded-[10px] bg-bg-secondary border border-border-default px-4 lg:px-5 py-4">
        {/* Client */}
        <div className="flex flex-col gap-1 py-2 min-w-0">
          <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
            {t("clientLabel").replace(":", "")}
          </span>
          <span className="text-[14px] font-medium text-text-primary break-words">
            {client}
          </span>
        </div>
        {/* Architects */}
        <div className="flex flex-col gap-1 py-2 min-w-0">
          <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
            {t("architects") || "Architects"}
          </span>
          <span className="text-[14px] font-medium text-text-primary break-words">
            {architects}
          </span>
        </div>
        {/* Created */}
        <div className="flex flex-col gap-1 py-2 min-w-0">
          <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
            {t("created") || "Created"}
          </span>
          <span className="text-[14px] font-medium text-text-primary whitespace-nowrap">
            {createdDate}
          </span>
        </div>
        {/* Location */}
        {(address || city || state) && (
          <div className="flex flex-col gap-1 py-2 min-w-0">
            <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
              {t("location") || "Location"}
            </span>
            <span className="text-[14px] font-medium text-text-primary break-words">
              {[address, city, state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {/* Scope */}
        {scope && (
          <div className="flex flex-col gap-1 py-2 min-w-0">
            <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
              {t("scope") || "Scope"}
            </span>
            <span className="text-[14px] font-medium text-text-primary break-words">
              {scope}
            </span>
          </div>
        )}
        {/* Area */}
        {areaSqft != null && (
          <div className="flex flex-col gap-1 py-2 min-w-0">
            <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
              {t("areaSqft") || "Area (SQFT)"}
            </span>
            <span className="text-[14px] font-medium text-text-primary">
              {areaSqft.toLocaleString()}
            </span>
          </div>
        )}
        {/* Estimate */}
        {estimationInr != null && (
          <div className="flex flex-col gap-1 py-2 min-w-0">
            <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
              {t("estimationInr") || "Estimate (INR)"}
            </span>
            <span className="text-[14px] font-medium text-text-primary">
              {estimationInr.toLocaleString("en-IN")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
