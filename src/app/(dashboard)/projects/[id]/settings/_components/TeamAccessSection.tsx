"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate } from "swr";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/useToast";
import { MemberPicker, ClientSelect } from "@/components/project/ProjectForm";
import { SettingsSection } from "./SettingsSection";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useUserRoleContext } from "@/contexts/UserRoleContext";

interface ProjectMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}
interface ProjectAccess {
  client_email: string | null;
  client_name: string | null;
  members?: ProjectMember[];
}

/** Team & Access: who manages, designs, and can view the project. */
export function TeamAccessSection({ projectId }: { projectId: string }) {
  const t = useTranslations("editProject");
  const t2 = useTranslations("projectSettings");
  const tc = useTranslations("common");
  const { members: architects } = useOrgMembers();
  const { members: clients } = useOrgMembers({ roleFilter: "client" });
  const { members: pmCandidates } = useOrgMembers({
    roleFilter: ["owner", "admin", "member"],
  });
  const isOwner = useUserRoleContext()?.orgRole === "owner";

  const { data: project, isLoading } = useSWR<ProjectAccess>(
    API.project(projectId)
  );

  const [selectedArchitects, setSelectedArchitects] = useState<string[]>([]);
  const [selectedPMs, setSelectedPMs] = useState<string[]>([]);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setSelectedArchitects(
      (project.members ?? [])
        .filter((m) => m.role === "architect")
        .map((m) => m.user_id)
    );
    setSelectedPMs(
      (project.members ?? [])
        .filter((m) => m.role === "pm")
        .map((m) => m.user_id)
    );
    setClientEmail(project.client_email ?? "");
    setClientName(project.client_name ?? "");
  }, [project]);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) =>
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  async function handleSave() {
    setSaving(true);
    try {
      await projects.update(projectId, {
        architectIds: selectedArchitects,
        ...(isOwner ? { pmIds: selectedPMs } : {}),
        clientEmail: clientEmail || null,
        clientName: clientName || null,
      });
      // Refresh the shared project cache so the members/client don't revert to
      // the pre-save snapshot when the user revisits this tab.
      await mutate(API.project(projectId));
      toast({ title: tc("save"), variant: "success" });
    } catch {
      toast({
        title: tc("error"),
        description: "Failed to update access",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <SettingsSection
      icon={Users}
      title={t2("nav.team")}
      description={t2("teamHelp")}
      action={
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      }
    >
      <Card>
        <div className="flex flex-col gap-4">
          {isOwner && (
            <MemberPicker
              label={t("assignPMs") || "Assign PMs"}
              placeholder={
                t("assignPMsPlaceholder") || "Select project managers…"
              }
              emptyText={t("noPMs") || "No team members available."}
              members={pmCandidates}
              selectedIds={selectedPMs}
              onToggle={(id) => toggle(setSelectedPMs, id)}
            />
          )}

          <MemberPicker
            label={t("assignTeam")}
            placeholder={t("assignTeamPlaceholder")}
            emptyText={t("noArchitects")}
            members={architects}
            selectedIds={selectedArchitects}
            onToggle={(id) => toggle(setSelectedArchitects, id)}
          />

          <ClientSelect
            clients={clients}
            email={clientEmail}
            onChange={(email, name) => {
              setClientEmail(email);
              setClientName(name);
            }}
            t={t}
          />
        </div>
      </Card>
    </SettingsSection>
  );
}
