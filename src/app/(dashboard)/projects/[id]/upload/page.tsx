"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Upload, FileText, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProjectById } from "@/data/mock";

export default function DesignUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("designUpload");
  const project = getProjectById(id);

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backTo", { name: project?.name || "project" })}
      </button>

      <PageHeader
        title={t("title")}
        subtitle={project?.name}
      />

      {/* Upload dropzone */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border-light bg-bg-secondary p-12 hover:border-accent/50 transition-colors cursor-pointer">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-bg-elevated">
          <Upload className="w-6 h-6 text-text-secondary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {t("dropzone")}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {t("dropzoneHint")}
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-secondary">
          {t("notes")}
        </label>
        <textarea
          placeholder={t("notesPlaceholder")}
          className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          rows={4}
        />
      </div>

      <Button className="self-start">
        <Upload className="w-4 h-4" />
        {t("uploadButton")}
      </Button>

      {/* Version History */}
      {project && project.designSections.length > 0 && (
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("versionHistory")}
          </h3>
          {project.designSections.map((section) => (
            <Card key={section.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-text-muted" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">
                      {section.name} — v{section.version}
                    </span>
                    <span className="text-xs text-text-muted">
                      {section.uploadedBy} &middot;{" "}
                      {new Date(section.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Badge variant={section.status as any}>
                  {section.status
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
