"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Upload,
  Eye,
  ArrowLeft,
  Edit,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getProjectById } from "@/data/mock";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("projectDetail");
  const tc = useTranslations("common");
  const project = getProjectById(id);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">{tc("projectNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Back button */}
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push(`/projects/${id}/edit`)}
            >
              <Edit className="w-4 h-4" />
              {t("editButton")}
            </Button>
            <Button onClick={() => router.push(`/projects/${id}/upload`)}>
              <Upload className="w-4 h-4" />
              {t("uploadDesign")}
            </Button>
          </div>
        }
      />

      {/* Project info row */}
      <div className="flex gap-6">
        <div className="flex-1 flex flex-col gap-6">
          {/* Project meta */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t("clientLabel")}</span>
              <span className="text-text-primary font-medium">
                {project.client}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t("statusLabel")}</span>
              <Badge variant={statusToBadgeVariant(project.status)}>
                {project.status.charAt(0).toUpperCase() +
                  project.status.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-text-muted">
              <Calendar className="w-3.5 h-3.5 text-warning" />
              <span>
                {t("duePrefix")}{" "}
                {new Date(project.deadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Team */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("teamMembers")}
            </h3>
            <div className="flex gap-3">
              {project.team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2"
                >
                  <Avatar initials={member.initials} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">
                      {member.name}
                    </span>
                    <span className="text-xs text-text-muted capitalize">
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Design Sections */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("designSections")}
            </h3>
            {project.designSections.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">
                {t("emptyDesignSections")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {project.designSections.map((section) => (
                  <Card key={section.id} hover className="!p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-text-primary">
                          {section.name}
                        </span>
                        <span className="text-xs text-text-muted">
                          v{section.version} &middot; {t("uploadedBy")}{" "}
                          {section.uploadedBy} &middot;{" "}
                          {new Date(section.uploadedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={statusToBadgeVariant(section.status)}
                        >
                          {section.status
                            .split("-")
                            .map(
                              (w) =>
                                w.charAt(0).toUpperCase() + w.slice(1)
                            )
                            .join(" ")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/projects/${id}/review/${section.id}`
                            )
                          }
                        >
                          <Eye className="w-4 h-4" />
                          {t("viewReview")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
