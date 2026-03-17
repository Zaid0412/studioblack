"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FolderOpen, Calendar, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
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

/**
 *
 */
export default function ClientProjectsPage() {
  const t = useTranslations("projects");
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

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={te("clientProjectsTitle")}
          description={te("clientProjectsDescription")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  );
}
