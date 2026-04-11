"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  ClipboardCheck,
  CheckCircle2,
  Users,
  Calendar,
  Loader2,
  AlertCircle,
  Activity,
  Clock,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { activityIcons, activityColors } from "@/lib/activityConstants";
import { formatTimeAgo } from "@/lib/formatTime";
import { useUserRole } from "@/hooks/useUserRole";
import { formatShortDate, formatDate } from "@/lib/formatDate";

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

interface ClientProject {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  deadline: string | null;
  created_at: string;
}

/** Unified dashboard — adapts content based on user role. */
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tClient = useTranslations("clientDashboard");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const { role, session, loading: roleLoading } = useUserRole();

  const {
    data,
    isLoading: dashLoading,
    error: dashError,
    mutate: dashMutate,
  } = useSWR<DashboardData>(
    !roleLoading && role && role !== "client" ? "/api/dashboard" : null
  );
  const {
    data: clientProjects = [],
    isLoading: clientLoading,
    error: clientError,
    mutate: clientMutate,
  } = useSWR<ClientProject[]>(
    !roleLoading && role === "client" ? "/api/client/projects" : null
  );

  const loading =
    roleLoading || (role === "client" ? clientLoading : dashLoading);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const error = role === "client" ? clientError : dashError;
  const retry = role === "client" ? clientMutate : dashMutate;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-text-muted">Something went wrong loading your dashboard.</p>
        <Button variant="secondary" size="sm" onClick={() => retry()}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Client Dashboard ──────────────────────────────────────────────────
  if (role === "client") {
    const totalProjects = clientProjects.length;
    const activeProjects = clientProjects.filter(
      (p) => p.status === "active"
    ).length;
    const completedProjects = clientProjects.filter(
      (p) => p.status === "completed"
    ).length;

    const clientStats = [
      {
        label: tClient("totalProjects"),
        value: String(totalProjects),
        valueColor: "text-text-primary",
        icon: FolderOpen,
      },
      {
        label: tClient("pendingReview"),
        value: String(activeProjects),
        valueColor: "text-accent",
        icon: ClipboardCheck,
      },
      {
        label: tClient("reviewed"),
        value: String(completedProjects),
        valueColor: "text-success",
        icon: CheckCircle2,
      },
    ];

    return (
      <div className="flex flex-col gap-7 max-w-[1200px]">
        <PageHeader title={tClient("title")} subtitle={tClient("subtitle")} />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {clientStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-muted">
                  {stat.label}
                </span>
                <stat.icon className="w-4 h-4 text-text-muted" />
              </div>
              <span className={`text-[32px] font-bold ${stat.valueColor}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">
            {tClient("myProjects")}
          </h2>
          {clientProjects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={te("clientProjectsTitle")}
              description={te("clientProjectsDescription")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientProjects.map((project) => (
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
                      <Badge
                        variant={statusToBadgeVariant(
                          project.status as
                            | "active"
                            | "completed"
                            | "archived"
                            | "draft"
                        )}
                      >
                        {project.status.charAt(0).toUpperCase() +
                          project.status.slice(1)}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-secondary">
                      {project.category
                        ? project.category.charAt(0).toUpperCase() +
                          project.category.slice(1)
                        : "\u2014"}
                    </span>
                    {project.deadline && (
                      <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border-default">
                        <Calendar className="w-3 h-3 text-warning" />
                        {formatShortDate(project.deadline)}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PM / Architect Dashboard ──────────────────────────────────────────
  const stats = data
    ? [
        {
          label: t("activeProjects"),
          value: String(data.stats.active),
          icon: FolderOpen,
        },
        {
          label: t("pendingReviews"),
          value: String(data.stats.pendingReviews),
          valueColor: "text-accent",
          icon: ClipboardCheck,
        },
        {
          label: t("approvedDesigns"),
          value: String(data.stats.approved),
          valueColor: "text-success",
          icon: CheckCircle2,
        },
        {
          label: t("teamMembers"),
          value: String(data.stats.teamMembers),
          icon: Users,
        },
      ]
    : [];

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

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-muted">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-text-muted" />
            </div>
            <span
              className={`text-[32px] font-bold ${stat.valueColor || "text-text-primary"}`}
            >
              {stat.value}
            </span>
          </div>
        ))}
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
                    <span>
                      {formatDate(project.deadline)}
                    </span>
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
