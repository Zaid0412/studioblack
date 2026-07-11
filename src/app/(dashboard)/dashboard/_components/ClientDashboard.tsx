"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { FolderOpen, CheckCircle2, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { formatShortDate } from "@/lib/formatDate";
import { PendingReviewsPopover } from "@/components/dashboard/PendingReviewsPopover";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { DashboardError } from "./DashboardError";

interface ClientProject {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  deadline: string | null;
  created_at: string;
}

interface ClientPendingReviewsCount {
  total: number;
}

/** Client dashboard — their projects + pending reviews. */
export function ClientDashboard() {
  const tClient = useTranslations("clientDashboard");
  const te = useTranslations("emptyStates");
  const router = useRouter();

  const {
    data: clientProjects = [],
    isLoading,
    error,
    mutate,
  } = useSWR<ClientProject[]>("/api/client/projects");
  const { data: clientPending } = useSWR<ClientPendingReviewsCount>(
    "/api/client/pending-reviews"
  );

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError onRetry={() => mutate()} />;

  const totalProjects = clientProjects.length;
  const completedProjects = clientProjects.filter(
    (p) => p.status === "completed"
  ).length;

  return (
    <div className="flex flex-col gap-7 max-w-[1200px]">
      <PageHeader title={tClient("title")} subtitle={tClient("subtitle")} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={tClient("totalProjects")}
          value={String(totalProjects)}
          icon={FolderOpen}
          href="/projects"
        />
        <PendingReviewsPopover
          label={tClient("pendingReview")}
          count={clientPending?.total ?? 0}
          audience="client"
        />
        <StatCard
          label={tClient("reviewed")}
          value={String(completedProjects)}
          icon={CheckCircle2}
          valueColor="text-success"
        />
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
                      : "—"}
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
