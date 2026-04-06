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
import { projects } from "@/lib/api";

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
  const [clientEmail, setClientEmail] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [scope, setScope] = useState("");
  const [areaSqft, setAreaSqft] = useState("");
  const [estimationInr, setEstimationInr] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    projects
      .get<ProjectData>(id)
      .then((data) => {
        setProject(data);
        setName(data.name);
        setClientName(data.client_name || "");
        setClientEmail(data.client_email || "");
        setDeadline(data.deadline ? new Date(data.deadline) : undefined);
        setScope(data.scope || "");
        setAreaSqft(data.area_sqft != null ? String(data.area_sqft) : "");
        setEstimationInr(
          data.estimation_inr != null ? String(data.estimation_inr) : ""
        );
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await projects.update(id, {
        name: name.trim(),
        clientName: clientName.trim() || null,
        clientEmail: clientEmail.trim() || null,
        deadline: deadline?.toISOString().split("T")[0] || null,
        scope: scope.trim() || null,
        areaSqft: areaSqft ? Number(areaSqft) : null,
        estimationInr: estimationInr ? Number(estimationInr) : null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      });
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

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Input
            label={t("projectName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={t("client")}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <Input
            label={t("clientEmail")}
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
          <Input
            label={t("address")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("city")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label={t("state")}
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <DatePicker
            label={t("deadline")}
            value={deadline}
            onChange={setDeadline}
          />

          {/* Project Scope */}
          <div className="flex flex-col gap-3 mt-2">
            <h3 className="text-base font-semibold text-text-primary">
              {t("projectScope")}
            </h3>
            <Input
              label={t("scope")}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("areaSqft")}
                type="number"
                value={areaSqft}
                onChange={(e) => setAreaSqft(e.target.value)}
              />
              <Input
                label={t("estimationInr")}
                type="number"
                value={estimationInr}
                onChange={(e) => setEstimationInr(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mt-4">
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full lg:w-auto"
            >
              {saving ? tc("loading") : t("saveChanges")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/projects/${id}`)}
              className="w-full lg:w-auto"
            >
              {tc("cancel")}
            </Button>

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
