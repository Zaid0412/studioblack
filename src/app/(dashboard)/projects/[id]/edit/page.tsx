"use client";

import { use, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "../../_components/DeleteProjectDialog";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import {
  ProjectForm,
  type ProjectFormData,
} from "@/components/project/ProjectForm";

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

/** Project settings and edit form. */
export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("editProject");
  const tc = useTranslations("common");
  const { members: architects } = useOrgMembers();
  const { members: clients } = useOrgMembers({ roleFilter: "client" });
  const { members: pmCandidates } = useOrgMembers({
    roleFilter: ["owner", "admin", "member"],
  });
  // Only org owners can change the PM list. Admins/architects see the form
  // without the PM picker; their submit doesn't include `pmIds` so the API
  // owner-only gate (PATCH) never trips.
  const userRoleContext = useUserRoleContext();
  const isOwner = userRoleContext?.orgRole === "owner";
  // `role` is the project-scoped role from the layout's UserRoleProvider —
  // architects promoted to project-PM see `role === "pm"` here, pure
  // architects/clients do not. Pure architects/clients are bounced back to
  // the project page; the PATCH endpoint also 403s them as a backstop.
  const role = userRoleContext?.role;
  useEffect(() => {
    if (role && role !== "pm") {
      router.replace(`/projects/${id}`);
    }
  }, [role, id, router]);

  const { data: project, isLoading: loading } = useSWR<ProjectData>(
    API.project(id)
  );
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
            .filter((m: ProjectMember) => m.role === "architect")
            .map((m: ProjectMember) => m.user_id)
        : [],
      selectedPMs: project.members
        ? project.members
            .filter((m: ProjectMember) => m.role === "pm")
            .map((m: ProjectMember) => m.user_id)
        : [],
    };
  }, [project]);

  async function handleSave(data: ProjectFormData) {
    if (!data.name.trim()) return;
    setSaving(true);
    try {
      await projects.update(id, {
        name: data.name.trim(),
        clientName: data.clientName?.trim() || null,
        clientEmail: data.clientEmail.trim() || null,
        deadline: data.deadline?.toISOString().split("T")[0] || null,
        scope: data.scope.trim() || null,
        areaSqft: data.areaSqft ? Number(data.areaSqft) : null,
        estimationInr: data.estimationInr ? Number(data.estimationInr) : null,
        address: data.address.trim() || null,
        city: data.city.trim() || null,
        state: data.state.trim() || null,
        architectIds: data.selectedArchitects,
        // Only include pmIds when the viewer is the org owner. The PATCH
        // endpoint 403s any non-owner that sends this field.
        ...(isOwner ? { pmIds: data.selectedPMs } : {}),
      });
      toast({
        title: t("updatedToast"),
        description: t("updatedDescription", { name: data.name.trim() }),
        variant: "success",
      });
      router.push(`/projects/${id}`);
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

  async function handleDelete() {
    setDeleting(true);
    try {
      await projects.remove(id);
      toast({
        title: t("deletedToast"),
        description: t("deletedDescription", { name: project?.name || "" }),
        variant: "error",
      });
      router.push("/projects");
    } catch {
      toast({
        title: tc("error"),
        description: "Failed to delete project",
        variant: "error",
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[800px]">
        <Skeleton className="h-4 w-36" />
        <PageHeader title={t("title")} />
        <Card>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-text-muted">{tc("projectNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backTo", { name: project.name })}
      </button>

      <PageHeader title={t("title")} subtitle={project.name} />

      <ProjectForm
        mode="edit"
        initialData={initialData}
        architects={architects}
        pms={isOwner ? pmCandidates : undefined}
        clients={clients}
        onSubmit={handleSave}
        onCancel={() => router.push(`/projects/${id}`)}
        submitting={saving}
        t={t}
        tc={tc}
        submitLabel={t("saveChanges")}
        footerExtra={
          <>
            <Button
              type="button"
              variant="danger"
              className="w-full lg:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              {t("deleteProject")}
            </Button>
            <DeleteProjectDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={t("deleteTitle", { name: project.name })}
              description={t("deleteDescription")}
              confirmLabel={t("deleteConfirm")}
              confirming={deleting}
              onConfirm={handleDelete}
            />
          </>
        }
      />
    </div>
  );
}
