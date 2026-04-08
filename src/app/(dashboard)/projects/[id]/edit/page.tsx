"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2, Loader2, X, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
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
import { authClient } from "@/lib/authClient";
import { deriveInitials, cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { OrgMember } from "@/types";

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

  // Org members (architects) for assignment
  const [architects, setArchitects] = useState<OrgMember[]>([]);
  const [selectedArchitects, setSelectedArchitects] = useState<string[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadArchitects() {
      try {
        const { data } = await authClient.organization.getFullOrganization();
        if (data?.members) {
          const assignable = (data.members as OrgMember[]).filter(
            (m) => m.role === "member" || m.role === "admin"
          );
          setArchitects(assignable);
        }
      } catch {
        console.error("Failed to load org members");
      }
    }
    loadArchitects();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        teamDropdownRef.current &&
        !teamDropdownRef.current.contains(e.target as Node)
      ) {
        setTeamDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleArchitect = (userId: string) => {
    setSelectedArchitects((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

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
        if (data.members) {
          setSelectedArchitects(
            data.members
              .filter((m: ProjectMember) => m.role === "architect")
              .map((m: ProjectMember) => m.user_id)
          );
        }
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
        architectIds: selectedArchitects,
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
            autoComplete="email"
          />
          {/* Assign Team */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("assignTeam")}
            </label>
            {architects.length === 0 ? (
              <p className="text-xs text-text-muted">{t("noArchitects")}</p>
            ) : (
              <div className="relative" ref={teamDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                  className="flex items-center flex-wrap gap-1.5 w-full min-h-[42px] rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary cursor-pointer hover:border-accent/50 transition-colors"
                >
                  {selectedArchitects.length === 0 ? (
                    <span className="text-text-muted">
                      {t("assignTeamPlaceholder")}
                    </span>
                  ) : (
                    selectedArchitects.map((userId) => {
                      const member = architects.find(
                        (a) => a.user.id === userId
                      );
                      if (!member) return null;
                      return (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1 rounded-md bg-accent/10 text-accent px-2 py-0.5 text-xs font-medium"
                        >
                          {member.user.name}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleArchitect(userId);
                            }}
                          />
                        </span>
                      );
                    })
                  )}
                </button>
                {teamDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border-default bg-bg-primary shadow-lg py-1 max-h-48 overflow-y-auto">
                    {architects.map((member) => {
                      const isSelected = selectedArchitects.includes(
                        member.user.id
                      );
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleArchitect(member.user.id)}
                          className={cn(
                            "flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-bg-elevated/50 transition-colors cursor-pointer",
                            isSelected && "bg-accent/5"
                          )}
                        >
                          <Avatar
                            initials={deriveInitials(member.user.name)}
                            size="sm"
                            src={member.user.image ?? undefined}
                            color={avatarColor(member.user.id)}
                          />
                          <div className="flex flex-col items-start min-w-0 flex-1">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {member.user.name}
                            </span>
                            <span className="text-xs text-text-muted truncate">
                              {member.user.email}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-accent shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

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
