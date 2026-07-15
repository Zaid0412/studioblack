"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  ProjectForm,
  type ProjectFormData,
} from "@/components/project/ProjectForm";
import { SettingsSection } from "./SettingsSection";

interface ProjectMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface ProjectData {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  deadline: string | null;
  scope: string | null;
  area_sqft: number | null;
  estimation_inr: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  members?: ProjectMember[];
}

/** The project's editable details — the former /edit form, now a settings panel. */
export function ProjectDetailsSection({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useTranslations("editProject");
  const ts = useTranslations("projectSettings");
  const tc = useTranslations("common");
  // Access (PM/architect/client) lives in the Team & Access section now; the
  // Details form only edits the project's own fields.
  const { members: architects } = useOrgMembers();

  const { data: project, isLoading: loading } = useSWR<ProjectData>(
    API.project(projectId)
  );
  const [saving, setSaving] = useState(false);

  const initialData = useMemo(() => {
    if (!project) return undefined;
    return {
      name: project.name,
      clientName: project.client_name || "",
      clientEmail: project.client_email || "",
      category: project.category,
      deadline: project.deadline ? new Date(project.deadline) : undefined,
      scope: project.scope || "",
      areaSqft: project.area_sqft != null ? String(project.area_sqft) : "",
      estimationInr:
        project.estimation_inr != null ? String(project.estimation_inr) : "",
      address: project.address || "",
      city: project.city || "",
      state: project.state || "",
      selectedArchitects: project.members
        ? project.members
            .filter((m) => m.role === "architect")
            .map((m) => m.user_id)
        : [],
      selectedPMs: project.members
        ? project.members.filter((m) => m.role === "pm").map((m) => m.user_id)
        : [],
    };
  }, [project]);

  async function handleSave(data: ProjectFormData) {
    if (!data.name.trim()) return;
    setSaving(true);
    try {
      await projects.update(projectId, {
        name: data.name.trim(),
        deadline: data.deadline?.toISOString().split("T")[0] || null,
        scope: data.scope.trim() || null,
        areaSqft: data.areaSqft ? Number(data.areaSqft) : null,
        estimationInr: data.estimationInr ? Number(data.estimationInr) : null,
        address: data.address.trim() || null,
        city: data.city.trim() || null,
        state: data.state.trim() || null,
      });
      toast({
        title: t("updatedToast"),
        description: t("updatedDescription", { name: data.name.trim() }),
        variant: "success",
      });
      router.push(`/projects/${projectId}`);
    } catch {
      toast({
        title: tc("error"),
        description: "Failed to update project",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!project) {
    return <p className="text-text-muted">{tc("projectNotFound")}</p>;
  }

  return (
    <SettingsSection
      icon={SlidersHorizontal}
      title={ts("nav.details")}
      description={ts("detailsHelp")}
    >
      <ProjectForm
        mode="edit"
        initialData={initialData}
        architects={architects}
        showAccessFields={false}
        onSubmit={handleSave}
        onCancel={() => router.push(`/projects/${projectId}`)}
        submitting={saving}
        t={t}
        tc={tc}
        submitLabel={t("saveChanges")}
      />
    </SettingsSection>
  );
}
