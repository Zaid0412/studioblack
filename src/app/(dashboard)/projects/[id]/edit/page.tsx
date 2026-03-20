"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Card } from "@/components/ui/card";
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

interface ProjectData {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  description: string;
  deadline: string | null;
  status: string;
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

  // Form state
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: ProjectData) => {
        setProject(data);
        setName(data.name);
        setClientName(data.client_name || "");
        setDescription(data.description || "");
        setDeadline(data.deadline ? new Date(data.deadline) : undefined);
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName.trim() || null,
          description: description.trim(),
          deadline: deadline?.toISOString().split("T")[0] || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({
        title: t("updatedToast"),
        description: t("updatedDescription", { name: name.trim() }),
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
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
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
        <Loader2 className="w-6 h-6 animate-spin text-[#666]" />
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

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Input
            label={t("projectName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t("client")}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              rows={3}
            />
          </div>
          <DatePicker
            label={t("deadline")}
            value={deadline}
            onChange={setDeadline}
          />

          <div className="flex items-center gap-3 mt-4">
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? tc("loading") : t("saveChanges")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/projects/${id}`)}
            >
              {tc("cancel")}
            </Button>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="danger" className="ml-auto">
                  <Trash2 className="w-4 h-4" />
                  {t("deleteProject")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {t("deleteTitle", { name: project.name })}
                  </DialogTitle>
                  <DialogDescription>
                    {t("deleteDescription")}
                  </DialogDescription>
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
          </div>
        </form>
      </Card>
    </div>
  );
}
