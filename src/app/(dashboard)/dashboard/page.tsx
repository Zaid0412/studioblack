"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  ClipboardCheck,
  CheckCircle2,
  Users,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { activities, projects } from "@/data/mock";
import { authClient } from "@/lib/authClient";
import { activityIcons, activityColors } from "@/lib/activityConstants";
import { formatTimeAgo } from "@/lib/formatTime";

/** Architect dashboard with stats, projects, and activity feed. */
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const stats = [
    {
      label: t("activeProjects"),
      value: "12",
      change: t("changeThisMonth", { count: 2 }),
      changeColor: "text-success",
      icon: FolderOpen,
    },
    {
      label: t("pendingReviews"),
      value: "7",
      change: t("awaitingApproval", { count: 3 }),
      changeColor: "text-text-secondary",
      valueColor: "text-accent",
      icon: ClipboardCheck,
    },
    {
      label: t("approvedDesigns"),
      value: "4",
      change: t("pendingClientSignoff", { count: 2 }),
      changeColor: "text-text-secondary",
      valueColor: "text-success",
      icon: CheckCircle2,
    },
    {
      label: t("teamMembers"),
      value: "8",
      change: t("teamComposition", { architects: 3, juniors: 5 }),
      changeColor: "text-text-secondary",
      icon: Users,
    },
  ];

  // Upcoming deadlines from projects
  const deadlines = projects
    .filter((p) => p.status === "active")
    .sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-7 max-w-[1200px]">
      {/* Header */}
      <PageHeader
        title={t("greeting", {
          name: session?.user?.name?.split(" ")[0] ?? "",
        })}
        subtitle={t("overviewSubtitle")}
        actions={
          <Button onClick={() => router.push("/projects/new")}>
            {t("newProject")}
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-5"
          >
            <span className="text-[13px] text-text-muted">{stat.label}</span>
            <span
              className={`text-[32px] font-bold ${stat.valueColor || "text-text-primary"}`}
            >
              {stat.value}
            </span>
            <span className={`text-xs ${stat.changeColor}`}>{stat.change}</span>
          </div>
        ))}
      </div>

      {/* Content row */}
      <div className="flex gap-6 min-h-0">
        {/* Recent Activity */}
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">
            {t("recentActivity")}
          </h2>
          <div className="flex flex-col gap-1">
            {activities.slice(0, 6).map((activity) => {
              const Icon = activityIcons[activity.type] || FolderOpen;
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-bg-elevated/50 transition-colors"
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5 ${activityColors[activity.type] || "bg-bg-elevated text-text-secondary"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {activity.user}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {activity.action.toLowerCase()}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {activity.project} &middot; {activity.details}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatTimeAgo(activity.timestamp, tc)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="w-80 flex flex-col gap-4 shrink-0">
          <h2 className="text-lg font-bold text-text-primary">
            {t("upcomingDeadlines")}
          </h2>
          <div className="flex flex-col gap-3">
            {deadlines.map((project) => (
              <Card
                key={project.id}
                hover
                onClick={() => router.push(`/projects/${project.id}`)}
                className="!p-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">
                      {project.name}
                    </span>
                    <Badge variant={project.status}>{project.status}</Badge>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {project.client}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Calendar className="w-3 h-3 text-warning" />
                    <span>
                      {new Date(project.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {/* Team avatars */}
                  <div className="flex -space-x-2 mt-1">
                    {project.team.slice(0, 3).map((member) => (
                      <Avatar
                        key={member.id}
                        initials={member.initials}
                        size="sm"
                        className="ring-2 ring-bg-secondary"
                      />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
