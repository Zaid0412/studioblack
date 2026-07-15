"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { mutate } from "swr";
import { Archive, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { DeleteProjectDialog } from "../../../_components/DeleteProjectDialog";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import { SettingsSection } from "./SettingsSection";

/** Danger Zone: archive (reversible) and permanent delete (owner only). */
export function ProjectDangerSection({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useTranslations("projectSettings");
  const te = useTranslations("editProject");
  const tc = useTranslations("common");
  const isOwner = useUserRoleContext()?.orgRole === "owner";
  const { data: project } = useSWR<{ name: string }>(API.project(projectId));
  const name = project?.name ?? "";

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      // The existing soft-delete endpoint archives (status='archived') — the
      // same path the project list's archive uses.
      await projects.remove(projectId);
      await mutate(API.projects());
      toast({ title: t("archivedToast"), variant: "success" });
      router.push("/projects");
    } catch {
      toast({ title: tc("error"), variant: "error" });
    } finally {
      setArchiving(false);
      setArchiveOpen(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await projects.destroy(projectId);
      await mutate(API.projects());
      toast({ title: t("deletedToast"), variant: "error" });
      router.push("/projects");
    } catch {
      toast({ title: tc("error"), variant: "error" });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const panel =
    "flex flex-col gap-3 rounded-xl border border-danger-border bg-danger-muted p-5";

  return (
    <SettingsSection
      icon={TriangleAlert}
      title={t("nav.danger")}
      description={t("dangerHelp")}
      danger
    >
      <div className={panel}>
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("archiveTitle")}
          </h3>
        </div>
        <p className="text-xs text-text-muted">{t("archiveDescription")}</p>
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setArchiveOpen(true)}
        >
          {t("archive")}
        </Button>
      </div>

      {isOwner && (
        <div className={panel}>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-danger" />
            <h3 className="text-sm font-semibold text-text-primary">
              {t("deleteTitle")}
            </h3>
          </div>
          <p className="text-xs text-text-muted">{t("deleteDescription")}</p>
          <Button
            type="button"
            variant="danger"
            className="self-start"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("deletePermanently")}
          </Button>
        </div>
      )}

      <DeleteProjectDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("archiveConfirmTitle", { name })}
        description={t("archiveConfirmDescription")}
        confirmLabel={t("archive")}
        confirming={archiving}
        onConfirm={handleArchive}
      />

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={te("deleteTitle", { name })}
        description={t("deletePermanentlyConfirm")}
        confirmLabel={t("deletePermanently")}
        confirming={deleting}
        onConfirm={handleDelete}
      />
    </SettingsSection>
  );
}
