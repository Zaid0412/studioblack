"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
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

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    projects
      .get<ProjectData>(id)
      .then((data) => {
        setProject(data);
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
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
        onSubmit={handleSave}
        onCancel={() => router.push(`/projects/${id}`)}
        submitting={saving}
        t={t}
        tc={tc}
        submitLabel={t("saveChanges")}
        footerExtra={
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="danger"
                className="w-full lg:w-auto lg:ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                {t("deleteProject")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("deleteTitle", { name: project.name })}
                </DialogTitle>
                <DialogDescription>{t("deleteDescription")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">{tc("cancel")}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? tc("loading") : t("deleteConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}
