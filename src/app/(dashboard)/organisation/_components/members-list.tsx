"use client";

import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { deriveInitials } from "@/lib/utils";
import { roleIcon, roleLabel } from "../_lib/role-helpers";
import type { OrgMember } from "@/types";

interface MembersListProps {
  members: OrgMember[];
  currentUserRole: string | null;
  onRemoveMember: (memberId: string) => void;
}

/**
 *
 */
export function MembersList({
  members,
  currentUserRole,
  onRemoveMember,
}: MembersListProps) {
  const t = useTranslations("organisation");

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-text-primary">
          {t("members")}
        </h3>
        <div className="flex flex-col">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 py-3 border-b border-border-default last:border-0"
            >
              <Avatar
                initials={deriveInitials(member.user.name)}
                size="sm"
                src={member.user.image ?? undefined}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-text-primary truncate">
                  {member.user.name}
                </span>
                <span className="text-xs text-text-muted truncate">
                  {member.user.email}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                {roleIcon(member.role)}
                <span className="text-xs font-medium">
                  {roleLabel(member.role, t)}
                </span>
              </div>
              {member.role !== "owner" &&
                (currentUserRole === "owner" ||
                  currentUserRole === "admin") && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={() => onRemoveMember(member.id)}
                      >
                        {t("removeMember")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
