"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, X, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { deriveInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { PROJECT_PHASES } from "@/lib/constants";
import type { OrgMember } from "@/types";

/** Create new project form. */
export default function CreateProjectPage() {
  const router = useRouter();
  const t = useTranslations("createProject");
  const tc = useTranslations("common");
  const [phases, setPhases] = useState<string[]>([...PROJECT_PHASES]);

  // Form fields
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Org members (architects) for assignment
  const [architects, setArchitects] = useState<OrgMember[]>([]);
  const [selectedArchitects, setSelectedArchitects] = useState<string[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadArchitects() {
      const { data } = await authClient.organization.getFullOrganization();
      if (data?.members) {
        // Show admin (PM) and member (Architect) roles — exclude owner
        const assignable = (data.members as OrgMember[]).filter(
          (m) => m.role === "member" || m.role === "admin"
        );
        setArchitects(assignable);
      }
    }
    loadArchitects();
  }, []);

  const teamDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        teamDropdownRef.current &&
        !teamDropdownRef.current.contains(e.target as Node)
      ) {
        setTeamDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleArchitect = (userId: string) => {
    setSelectedArchitects((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader title={t("title")} />

      <Card>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!projectName.trim()) {
              toast({
                title: t("validationError"),
                description: t("projectNameRequired"),
                variant: "error",
              });
              return;
            }
            if (!category) {
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
                name: projectName.trim(),
                clientName: clientName.trim() || undefined,
                clientEmail: clientEmail.trim() || undefined,
                category,
                description: description.trim() || undefined,
                deadline: deadline?.toISOString().split("T")[0],
                phases: phases.filter((p) => p.trim()) as unknown as {
                  name: string;
                }[],
                architectIds: selectedArchitects.length
                  ? selectedArchitects
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
                  err instanceof Error
                    ? err.message
                    : "Failed to create project",
                variant: "error",
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="flex flex-col gap-5"
        >
          <h3 className="text-base font-semibold text-text-primary">
            {t("projectDetails")}
          </h3>

          <Input
            label={t("projectName")}
            placeholder={t("projectNamePlaceholder")}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <Input
            label={t("client")}
            placeholder={t("clientPlaceholder")}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("category")}
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">
                  {t("categoryResidential")}
                </SelectItem>
                <SelectItem value="commercial">
                  {t("categoryCommercial")}
                </SelectItem>
                <SelectItem value="healthcare">
                  {t("categoryHealthcare")}
                </SelectItem>
                <SelectItem value="hospitality">
                  {t("categoryHospitality")}
                </SelectItem>
                <SelectItem value="institutional">
                  {t("categoryInstitutional")}
                </SelectItem>
                <SelectItem value="retail">{t("categoryRetail")}</SelectItem>
                <SelectItem value="workspace">
                  {t("categoryWorkspace")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              rows={3}
            />
          </div>

          <DatePicker
            label={t("deadline")}
            placeholder={t("deadlinePlaceholder")}
            value={deadline}
            onChange={setDeadline}
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

          {/* Client Email */}
          <div className="flex flex-col gap-1.5">
            <Input
              label={t("clientEmail")}
              type="email"
              placeholder={t("clientEmailPlaceholder")}
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
            <p className="text-xs text-text-muted">{t("clientEmailHint")}</p>
          </div>

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
                  onClick={() =>
                    setPhases(phases.filter((_, idx) => idx !== i))
                  }
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

          <div className="flex gap-3 mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tc("loading") : t("createButton")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/projects")}
            >
              {tc("cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
