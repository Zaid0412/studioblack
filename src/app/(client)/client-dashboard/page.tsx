"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  ClipboardCheck,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { projects, activities } from "@/data/mock";

export default function ClientDashboardPage() {
  const t = useTranslations("clientDashboard");
  const tc = useTranslations("common");
  const router = useRouter();

  const stats = [
    {
      label: t("totalProjects"),
      value: "3",
      valueColor: "text-text-primary",
      icon: FolderOpen,
    },
    {
      label: t("pendingReview"),
      value: "2",
      valueColor: "text-accent",
      icon: ClipboardCheck,
    },
    {
      label: t("reviewed"),
      value: "1",
      valueColor: "text-success",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flex flex-col gap-7 max-w-[1200px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-5"
          >
            <span className="text-[13px] text-text-muted">{stat.label}</span>
            <span className={`text-[32px] font-bold ${stat.valueColor}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* My Projects */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-text-primary">
          {t("myProjects")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.slice(0, 4).map((project) => (
            <Card
              key={project.id}
              hover
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">
                    {project.name}
                  </span>
                  <Badge variant={statusToBadgeVariant(project.status)}>
                    {project.status.charAt(0).toUpperCase() +
                      project.status.slice(1)}
                  </Badge>
                </div>
                <span className="text-xs text-text-secondary">
                  {project.description}
                </span>
                <div className="flex items-center justify-between pt-2 border-t border-border-default">
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member) => (
                      <Avatar
                        key={member.id}
                        initials={member.initials}
                        size="sm"
                        className="ring-2 ring-bg-secondary"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Calendar className="w-3 h-3 text-warning" />
                    {new Date(project.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-text-primary">
          {t("recentActivity")}
        </h2>
        <div className="flex flex-col gap-1">
          {activities.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-elevated/50 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span className="text-sm text-text-primary flex-1">
                <span className="font-medium">{activity.user}</span>{" "}
                <span className="text-text-secondary">
                  {activity.action.toLowerCase()}
                </span>{" "}
                <span className="text-text-muted">
                  {tc("on")} {activity.project}
                </span>
              </span>
              <span className="text-xs text-text-muted shrink-0">
                {new Date(activity.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
