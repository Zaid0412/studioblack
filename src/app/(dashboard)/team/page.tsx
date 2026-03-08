"use client";

import { useTranslations } from "next-intl";
import { UserPlus, Mail, FolderOpen, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { teamMembers } from "@/data/mock";

export default function TeamPage() {
  const t = useTranslations("team");

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button>
            <UserPlus className="w-4 h-4" />
            {t("inviteMember")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teamMembers.map((member) => (
          <Card key={member.id}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar initials={member.initials} size="lg" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-text-primary">
                      {member.name}
                    </span>
                    <span className="text-xs text-text-muted capitalize">
                      {member.role}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={
                    member.status === "active"
                      ? "success"
                      : member.status === "invited"
                        ? "info"
                        : "draft"
                  }
                >
                  {member.status.charAt(0).toUpperCase() +
                    member.status.slice(1)}
                </Badge>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>
                    {t("projectCount", { count: member.projects })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border-default">
                <span className="text-xs text-text-muted">
                  {t("joinedDate", {
                    date: new Date(member.joinedAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    }),
                  })}
                </span>
                <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
