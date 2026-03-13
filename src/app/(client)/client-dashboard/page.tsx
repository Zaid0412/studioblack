"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  ClipboardCheck,
  CheckCircle2,
  Calendar,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";

interface ClientProject {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  deadline: string | null;
  created_at: string;
}

/** Client-facing dashboard with real project data. */
export default function ClientDashboardPage() {
  const t = useTranslations("clientDashboard");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client/projects")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedProjects = projects.filter(
    (p) => p.status === "completed"
  ).length;

  const stats = [
    {
      label: t("totalProjects"),
      value: String(totalProjects),
      valueColor: "text-text-primary",
      icon: FolderOpen,
    },
    {
      label: t("pendingReview"),
      value: String(activeProjects),
      valueColor: "text-accent",
      icon: ClipboardCheck,
    },
    {
      label: t("reviewed"),
      value: String(completedProjects),
      valueColor: "text-success",
      icon: CheckCircle2,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

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
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={te("clientProjectsTitle")}
            description={te("clientProjectsDescription")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                hover
                onClick={() =>
                  router.push(`/client-dashboard/projects/${project.id}`)
                }
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">
                      {project.name}
                    </span>
                    <Badge variant={statusToBadgeVariant(project.status as "active" | "completed" | "archived" | "draft")}>
                      {project.status.charAt(0).toUpperCase() +
                        project.status.slice(1)}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {project.description || project.category}
                  </span>
                  {project.deadline && (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border-default">
                      <Calendar className="w-3 h-3 text-warning" />
                      {new Date(project.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
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
