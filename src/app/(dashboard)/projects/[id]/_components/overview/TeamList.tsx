"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { useScrollFade } from "@/hooks/useScrollFade";
import type { DbMember } from "@/types";
import { OverviewCard } from "./OverviewCard";

interface TeamListProps {
  members: DbMember[];
  variant: "pm" | "client";
}

const ROLE_KEY: Record<string, string> = {
  pm: "rolePm",
  architect: "roleArchitect",
};

/**
 * Project team. PM sees every member; the client sees only the studio
 * contacts (pm/architect) — their "your team" list.
 */
export function TeamList({ members, variant }: TeamListProps) {
  const t = useTranslations("projectOverview");
  const { ref, maskImage } = useScrollFade<HTMLUListElement>();
  const list =
    variant === "client"
      ? members.filter((m) => m.role === "pm" || m.role === "architect")
      : members;

  return (
    <OverviewCard title={variant === "client" ? t("yourTeam") : t("team")}>
      {list.length === 0 ? (
        <p className="text-[13px] text-text-muted">{t("noTeam")}</p>
      ) : (
        <>
          {/* Mobile: compact overlapping avatar stack. */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex -space-x-2">
              {list.slice(0, 5).map((m) => (
                <Avatar
                  key={m.user_id}
                  initials={deriveInitials(m.name)}
                  color={avatarColor(m.user_id)}
                  size="sm"
                  className="h-8 w-8 text-[11px] ring-2 ring-bg-secondary"
                />
              ))}
            </div>
            {list.length > 5 && (
              <span className="text-[13px] font-medium text-text-muted">
                +{list.length - 5}
              </span>
            )}
          </div>
          {/* Desktop: full scrollable list. */}
          <ul
            ref={ref}
            style={{ maskImage, WebkitMaskImage: maskImage }}
            className="hidden max-h-[280px] flex-col gap-3 overflow-y-auto pr-1 lg:flex"
          >
            {list.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3">
                <Avatar
                  initials={deriveInitials(m.name)}
                  color={avatarColor(m.user_id)}
                  size="sm"
                  className="h-8 w-8 text-[11px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text-primary">
                    {m.name}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">
                    {ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </OverviewCard>
  );
}
