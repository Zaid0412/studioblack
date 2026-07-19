"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, ChevronDown, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
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
  const [expanded, setExpanded] = useState(false);

  if (variant === "client") {
    return (
      <div className="px-4 lg:px-10 py-3 flex items-center gap-4 lg:gap-6 text-[13px] border-b border-border-default flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
        {status && (
          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">
              {t("statusLabel")}
            </span>
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
            <span className="text-text-secondary font-medium">
              {t("category")}:
            </span>
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
                  <TooltipContent side="bottom">{m.email}</TooltipContent>
                </Tooltip>
              ))}
              {members.length > 4 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium text-text-secondary bg-border-default border border-bg-secondary">
                  +{members.length - 4}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // PM variant \u2014 a compact summary that expands to the full detail grid.
  const client = clientName || clientEmail || "\u2014";
  const architectNames = members
    .filter((m) => m.role === "architect")
    .map((m) => m.name);
  const architects = architectNames.join(", ") || "\u2014";
  const pms =
    members
      .filter((m) => m.role === "pm")
      .map((m) => m.name)
      .join(", ") || "\u2014";
  const createdDate = formatDate(createdAt);
  const location = [address, city, state].filter(Boolean).join(", ");

  return (
    <div className="px-4 lg:px-10 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
      <div className="rounded-[10px] bg-bg-secondary border border-border-default px-4 lg:px-5 py-2.5">
        {/* Summary row \u2014 always visible */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]">
          <MetaInline
            label={t("clientLabel").replace(":", "")}
            value={client}
          />
          <Dot />
          <MetaInline label={t("pms") || "PMs"} value={pms} />
          {architectNames.length > 0 && (
            <>
              <Dot />
              <span className="text-text-primary font-medium">
                {architectNames.length} {t("architects") || "Architects"}
              </span>
            </>
          )}
          {areaSqft != null && (
            <>
              <Dot />
              <MetaInline
                label={t("areaSqft") || "Area (SQFT)"}
                value={areaSqft.toLocaleString()}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto flex items-center gap-1 text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            {t("details") || "Details"}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Detail grid \u2014 revealed on expand */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border-default grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            {location && (
              <MetaField label={t("location") || "Location"} value={location} />
            )}
            {scope && <MetaField label={t("scope") || "Scope"} value={scope} />}
            {estimationInr != null && (
              <MetaField
                label={t("estimationInr") || "Estimate (INR)"}
                value={estimationInr.toLocaleString("en-IN")}
              />
            )}
            <MetaField label={t("created") || "Created"} value={createdDate} />
            {architectNames.length > 0 && (
              <MetaField
                label={t("architects") || "Architects"}
                value={architects}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline `label value` summary item. */
function MetaInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 truncate">
      <span className="text-text-muted">{label}</span>{" "}
      <span className="text-text-primary font-medium">{value}</span>
    </span>
  );
}

/** Separator dot between summary items. */
function Dot() {
  return <span className="text-text-muted select-none">\u00b7</span>;
}

/** Stacked label/value cell in the expanded detail grid. */
function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-medium text-text-muted tracking-[0.5px] uppercase">
        {label}
      </span>
      <span className="text-[14px] font-medium text-text-primary break-words">
        {value}
      </span>
    </div>
  );
}
