"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  CheckCircle2,
  Users,
  Calendar,
  Activity,
  Clock,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/StatCard";
import { activityIcons, activityColors } from "@/lib/activityConstants";
import { formatTimeAgo } from "@/lib/formatTime";
import { formatDate } from "@/lib/formatDate";
import { useUserRole } from "@/hooks/useUserRole";
import { PendingReviewsPopover } from "@/components/dashboard/PendingReviewsPopover";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { DashboardError } from "./DashboardError";

interface DashboardData {
  stats: {
    active: number;
    pendingReviews: number;
    approved: number;
    teamMembers: number;
  };
  deadlines: {
    id: string;
    name: string;
    client_name: string | null;
    deadline: string;
    status: string;
  }[];
  recentActivity: {
    id: string;
    type: string;
    title: string;
    description: string;
    created_at: string;
    project_name: string | null;
  }[];
}

/** PM / architect dashboard — projects, pending reviews, activity, deadlines. */
export function PmDashboard() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { role, session } = useUserRole();

  const { data, isLoading, error, mutate } =
    useSWR<DashboardData>("/api/dashboard");

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError onRetry={() => mutate()} />;

  const isEmpty =
    data &&
    data.stats.active === 0 &&
    data.stats.pendingReviews === 0 &&
    data.stats.approved === 0;

  return (
    <div className="flex flex-col gap-7 max-w-[1200px]">
      <PageHeader
        title={t("greeting", {
          name: session?.user?.name?.split(" ")[0] ?? "",
        })}
        subtitle={t("overviewSubtitle")}
        actions={
          role === "pm" ? (
            <Button onClick={() => router.push("/projects/new")}>
              {t("newProject")}
            </Button>
          ) : undefined
        }
      />

      {/* Welcome banner when no projects exist */}
      {isEmpty && (
        <div className="rounded-xl border border-border-default bg-bg-elevated p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-accent" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-text-primary">
              {t("welcomeTitle")}
            </h2>
            <p className="text-sm text-text-muted max-w-[360px]">
              {t("welcomeDescription")}
            </p>
          </div>
          {role === "pm" && (
            <Button onClick={() => router.push("/projects/new")}>
              <Plus className="w-4 h-4" />
              {t("newProject")}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("activeProjects")}
          value={String(data?.stats.active ?? 0)}
          icon={FolderOpen}
          href="/projects"
        />
        <PendingReviewsPopover
          label={t("pendingReviews")}
          count={data?.stats.pendingReviews ?? 0}
          audience="internal"
        />
        <StatCard
          label={t("approvedDesigns")}
          value={String(data?.stats.approved ?? 0)}
          icon={CheckCircle2}
          valueColor="text-success"
        />
        <StatCard
          label={t("teamMembers")}
          value={String(data?.stats.teamMembers ?? 0)}
          icon={Users}
          href="/settings?section=organization"
        />
      </div>

      {/* Content row — stacks on mobile */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Recent Activity */}
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">
            {t("recentActivity")}
          </h2>
          <div className="flex flex-col gap-1">
            {(!data || data.recentActivity.length === 0) && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center">
                  <Activity className="w-6 h-6 text-text-muted" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-text-secondary">
                    {t("noActivity")}
                  </span>
                  <span className="text-xs text-text-muted text-center max-w-[240px]">
                    {t("noActivityHint")}
                  </span>
                </div>
              </div>
            )}
            {data?.recentActivity.map((item) => {
              const Icon = activityIcons[item.type] || FolderOpen;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-bg-elevated/50 transition-colors"
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5 ${activityColors[item.type] || "bg-bg-elevated text-text-secondary"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-medium text-text-primary">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="text-xs text-text-muted">
                        {item.project_name && `${item.project_name} · `}
                        {item.description}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {formatTimeAgo(item.created_at, tc)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="w-full lg:w-80 flex flex-col gap-4 lg:shrink-0">
          <h2 className="text-lg font-bold text-text-primary">
            {t("upcomingDeadlines")}
          </h2>
          <div className="flex flex-col gap-3">
            {(!data || data.deadlines.length === 0) && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center">
                  <Clock className="w-6 h-6 text-text-muted" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-text-secondary">
                    {t("noDeadlines")}
                  </span>
                  <span className="text-xs text-text-muted text-center max-w-[240px]">
                    {t("noDeadlinesHint")}
                  </span>
                </div>
              </div>
            )}
            {data?.deadlines.map((project) => (
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
                    <Badge
                      variant={statusToBadgeVariant(
                        project.status as "active" | "completed" | "draft"
                      )}
                    >
                      {project.status.charAt(0).toUpperCase() +
                        project.status.slice(1)}
                    </Badge>
                  </div>
                  {project.client_name && (
                    <span className="text-xs text-text-secondary">
                      {project.client_name}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Calendar className="w-3 h-3 text-warning" />
                    <span>{formatDate(project.deadline)}</span>
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
