"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { X, Check } from "lucide-react";
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
import { authClient } from "@/lib/authClient";
import { deriveInitials, cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { OrgMember } from "@/types";

export interface ProjectFormData {
  name: string;
  clientEmail: string;
  clientName?: string;
  category: string;
  deadline: Date | undefined;
  scope: string;
  areaSqft: string;
  estimationInr: string;
  address: string;
  city: string;
  state: string;
  selectedArchitects: string[];
}

interface ProjectFormProps {
  mode: "create" | "edit";
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  /** Translation function — caller passes their namespace-specific t() */
  t: (key: string, values?: Record<string, string>) => string;
  /** Common translations */
  tc: (key: string) => string;
  /** Extra sections rendered after scope (e.g. phase editor) */
  children?: ReactNode;
  /** Extra buttons rendered in the footer (e.g. delete dialog) */
  footerExtra?: ReactNode;
  submitLabel: string;
}

export function ProjectForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  submitting,
  t,
  tc,
  children,
  footerExtra,
  submitLabel,
}: ProjectFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [clientEmail, setClientEmail] = useState(
    initialData?.clientEmail ?? ""
  );
  const [clientName, setClientName] = useState(initialData?.clientName ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [deadline, setDeadline] = useState<Date | undefined>(
    initialData?.deadline
  );
  const [scope, setScope] = useState(initialData?.scope ?? "");
  const [areaSqft, setAreaSqft] = useState(initialData?.areaSqft ?? "");
  const [estimationInr, setEstimationInr] = useState(
    initialData?.estimationInr ?? ""
  );
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [city, setCity] = useState(initialData?.city ?? "");
  const [state, setState] = useState(initialData?.state ?? "");

  // Org members (architects) for assignment
  const [architects, setArchitects] = useState<OrgMember[]>([]);
  const [selectedArchitects, setSelectedArchitects] = useState<string[]>(
    initialData?.selectedArchitects ?? []
  );
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Sync when initialData changes (edit mode loads async)
  useEffect(() => {
    if (!initialData) return;
    setName(initialData.name ?? ""); // eslint-disable-line react-hooks/set-state-in-effect -- one-time sync from async-loaded data
    setClientEmail(initialData.clientEmail ?? "");
    setClientName(initialData.clientName ?? "");
    setCategory(initialData.category ?? "");
    setDeadline(initialData.deadline);
    setScope(initialData.scope ?? "");
    setAreaSqft(initialData.areaSqft ?? "");
    setEstimationInr(initialData.estimationInr ?? "");
    setAddress(initialData.address ?? "");
    setCity(initialData.city ?? "");
    setState(initialData.state ?? "");
    setSelectedArchitects(initialData.selectedArchitects ?? []);
  }, [initialData]);

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

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      clientEmail,
      clientName,
      category,
      deadline,
      scope,
      areaSqft,
      estimationInr,
      address,
      city,
      state,
      selectedArchitects,
    });
  }

  return (
    <Card>
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
        {mode === "create" && (
          <h3 className="text-base font-semibold text-text-primary">
            {t("projectDetails")}
          </h3>
        )}

        <Input
          label={t("projectName")}
          placeholder={
            mode === "create" ? t("projectNamePlaceholder") : undefined
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {mode === "create" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("category")}
              <span className="text-error ml-0.5">*</span>
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
        )}

        {mode === "edit" && (
          <>
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
          </>
        )}

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
                    const member = architects.find((a) => a.user.id === userId);
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
          placeholder={mode === "create" ? t("addressPlaceholder") : undefined}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t("city")}
            placeholder={mode === "create" ? t("cityPlaceholder") : undefined}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label={t("state")}
            placeholder={mode === "create" ? t("statePlaceholder") : undefined}
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>

        <DatePicker
          label={t("deadline")}
          placeholder={mode === "create" ? t("deadlinePlaceholder") : undefined}
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
            placeholder={mode === "create" ? t("scopePlaceholder") : undefined}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("areaSqft")}
              placeholder={
                mode === "create" ? t("areaSqftPlaceholder") : undefined
              }
              type="number"
              value={areaSqft}
              onChange={(e) => setAreaSqft(e.target.value)}
            />
            <Input
              label={t("estimationInr")}
              placeholder={
                mode === "create" ? t("estimationInrPlaceholder") : undefined
              }
              type="number"
              value={estimationInr}
              onChange={(e) => setEstimationInr(e.target.value)}
            />
          </div>
        </div>

        {/* Client Email — create mode places it after scope */}
        {mode === "create" && (
          <div className="flex flex-col gap-1.5">
            <Input
              label={t("clientEmail")}
              type="email"
              placeholder={t("clientEmailPlaceholder")}
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="text-xs text-text-muted">{t("clientEmailHint")}</p>
          </div>
        )}

        {children}

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mt-4">
          <Button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full lg:w-auto"
          >
            {submitting ? tc("loading") : submitLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="w-full lg:w-auto"
          >
            {tc("cancel")}
          </Button>
          {footerExtra}
        </div>
      </form>
    </Card>
  );
}
