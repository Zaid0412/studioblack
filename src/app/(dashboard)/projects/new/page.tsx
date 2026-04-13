"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { PROJECT_PHASES } from "@/lib/constants";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  ProjectForm,
  type ProjectFormData,
} from "@/components/project/ProjectForm";

/** Create new project form. */
export default function CreateProjectPage() {
  const router = useRouter();
  const t = useTranslations("createProject");
  const tc = useTranslations("common");
  const { members: architects } = useOrgMembers();
  const { members: clients } = useOrgMembers({ roleFilter: "client" });
  const [phases, setPhases] = useState<string[]>([...PROJECT_PHASES]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: ProjectFormData) {
    if (!data.name.trim()) {
      toast({
        title: t("validationError"),
        description: t("projectNameRequired"),
        variant: "error",
      });
      return;
    }
    if (!data.category) {
      toast({
        title: t("validationError"),
        description: t("categoryRequired"),
        variant: "error",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await projects.create({
        name: data.name.trim(),
        clientName: data.clientName?.trim() || undefined,
        clientEmail: data.clientEmail.trim() || undefined,
        category: data.category,
        deadline: data.deadline?.toISOString().split("T")[0],
        scope: data.scope.trim() || undefined,
        areaSqft: data.areaSqft ? Number(data.areaSqft) : undefined,
        estimationInr: data.estimationInr
          ? Number(data.estimationInr)
          : undefined,
        address: data.address.trim() || undefined,
        city: data.city.trim() || undefined,
        state: data.state.trim() || undefined,
        phases: phases.filter((p) => p.trim()) as unknown as {
          name: string;
        }[],
        architectIds: data.selectedArchitects.length
          ? data.selectedArchitects
          : undefined,
      });
      toast({
        title: t("createdToast"),
        description: t("createdDescription"),
        variant: "success",
      });
      router.push("/projects");
    } catch (err) {
      toast({
        title: tc("error") ?? "Error",
        description:
          err instanceof Error ? err.message : "Failed to create project",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader title={t("title")} />

      <ProjectForm
        mode="create"
        architects={architects}
        clients={clients}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/projects")}
        submitting={isSubmitting}
        t={t}
        tc={tc}
        submitLabel={t("createButton")}
      >
        {/* Design Phases */}
        <div className="flex flex-col gap-3 mt-2">
          <h3 className="text-base font-semibold text-text-primary">
            {t("designSections")}
          </h3>
          {phases.map((phase, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={phase}
                onChange={(e) => {
                  const updated = [...phases];
                  updated[i] = e.target.value;
                  setPhases(updated);
                }}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setPhases(phases.filter((_, idx) => idx !== i))}
                className="p-2 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                disabled={phases.length <= 1}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setPhases([...phases, ""])}
          >
            <Plus className="w-4 h-4" />
            {t("addSection")}
          </Button>
        </div>
      </ProjectForm>
    </div>
  );
}
