"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Shield, User as UserIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { roleIcon, roleLabel } from "../_lib/RoleHelpers";
import type { OrgMember } from "@/types";

interface MembersListProps {
  members: OrgMember[];
  currentUserRole: string | null;
  onUpdateRole: (memberId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
}

const roleOptions = [
  { value: "admin", icon: Shield, labelKey: "rolePM" },
  { value: "member", icon: UserIcon, labelKey: "roleArchitect" },
] as const;

function MemberRow({
  member,
  currentUserRole,
  onUpdateRole,
  onRemoveMember,
  t,
}: {
  member: OrgMember;
  currentUserRole: string | null;
  onUpdateRole: (memberId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const isClient = member.role === "client";
  const canManage =
    member.role !== "owner" &&
    (currentUserRole === "owner" || currentUserRole === "admin");

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-default last:border-0">
      <Avatar
        initials={deriveInitials(member.user.name)}
        size="sm"
        src={member.user.image ?? undefined}
        color={avatarColor(member.user.id)}
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
        <span className="text-xs font-medium">{roleLabel(member.role, t)}</span>
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Don't allow role changes for clients — only remove */}
            {!isClient &&
              currentUserRole === "owner" &&
              roleOptions
                .filter((r) => r.value !== member.role)
                .map((r) => (
                  <DropdownMenuItem
                    key={r.value}
                    onClick={() => onUpdateRole(member.id, r.value)}
                  >
                    <r.icon className="w-3.5 h-3.5 mr-2" />
                    {t("changeRoleTo", { role: t(r.labelKey) })}
                  </DropdownMenuItem>
                ))}
            {!isClient && currentUserRole === "owner" && (
              <DropdownMenuSeparator />
            )}
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
  );
}

/** Renders the organisation members split into Team and Clients sections. */
export function MembersList({
  members,
  currentUserRole,
  onUpdateRole,
  onRemoveMember,
}: MembersListProps) {
  const t = useTranslations("organisation");

  const { teamMembers, clientMembers } = useMemo(() => {
    const team: OrgMember[] = [];
    const clients: OrgMember[] = [];
    for (const m of members) {
      if (m.role === "client") {
        clients.push(m);
      } else {
        team.push(m);
      }
    }
    return { teamMembers: team, clientMembers: clients };
  }, [members]);

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-text-primary">
            {t("members")}
          </h3>
          <div className="flex flex-col">
            {teamMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUserRole={currentUserRole}
                onUpdateRole={onUpdateRole}
                onRemoveMember={onRemoveMember}
                t={t}
              />
            ))}
          </div>
        </div>
      </Card>

      {clientMembers.length > 0 && (
        <Card>
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-text-primary">
              {t("roleClient", { count: clientMembers.length })}
            </h3>
            <div className="flex flex-col">
              {clientMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserRole={currentUserRole}
                  onUpdateRole={onUpdateRole}
                  onRemoveMember={onRemoveMember}
                  t={t}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
