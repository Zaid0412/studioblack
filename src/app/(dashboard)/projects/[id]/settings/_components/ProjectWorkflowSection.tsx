"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Workflow, Layers, ListChecks, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { DbPhase, DbStep } from "@/types";
import { SettingsSection, SettingsEmpty } from "./SettingsSection";

interface ProjectWorkflowData {
  phases: DbPhase[];
  steps: DbStep[];
}

/** One name + toggle row, with an optional locked reason under it. */
function ToggleRow({
  label,
  checked,
  disabled,
  pending,
  lockedHint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  pending: boolean;
  lockedHint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-elevated/50">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-sm ${
            checked ? "text-text-primary" : "text-text-muted"
          }`}
        >
          {label}
        </span>
        <ToggleSwitch
          checked={checked}
          onChange={onChange}
          disabled={disabled || pending}
        />
      </div>
      {lockedHint && (
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Lock className="h-3 w-3" />
          {lockedHint}
        </span>
      )}
    </div>
  );
}

/** Per-project Phases & Workflow visibility — toggling hides the tab/stepper entry, never the data. */
export function ProjectWorkflowSection({ projectId }: { projectId: string }) {
  const t = useTranslations("projectSettings");
  const tc = useTranslations("common");
  const {
    data: project,
    isLoading,
    mutate: mutateProject,
  } = useSWR<ProjectWorkflowData>(API.project(projectId));
  const [pendingId, setPendingId] = useState<string | null>(null);

  const phases = project?.phases ?? [];
  const steps = project?.steps ?? [];
  const enabledPhaseCount = phases.filter((p) => p.enabled).length;
  // Only these three workflow stages have a real tab today; the rest exist as
  // labels but aren't wired up, so we don't offer a (no-op) toggle for them.
  const liveSteps = steps.filter((s) => LIVE_STEP_NAMES.has(s.name));
  const comingSoonSteps = steps.filter((s) => !LIVE_STEP_NAMES.has(s.name));

  /**
   * Optimistic toggle: flip the row in the SWR cache immediately (instant feel),
   * fire the PATCH in the background, and roll back if it fails. No full refetch.
   */
  async function toggle(
    kind: "phases" | "steps",
    id: string,
    enabled: boolean,
    run: () => Promise<unknown>
  ) {
    // Flip only this row's `enabled`, preserving the rest of the project payload
    // (the same SWR key backs the whole project detail).
    const flip = <T extends { id: string; enabled: boolean }>(arr: T[]) =>
      arr.map((e) => (e.id === id ? { ...e, enabled } : e));
    const patch = (data?: ProjectWorkflowData): ProjectWorkflowData => ({
      ...(data as ProjectWorkflowData),
      phases:
        kind === "phases" ? flip(data?.phases ?? []) : (data?.phases ?? []),
      steps: kind === "steps" ? flip(data?.steps ?? []) : (data?.steps ?? []),
    });
    setPendingId(id);
    try {
      await mutateProject(
        async (current) => {
          await run();
          return patch(current);
        },
        { optimisticData: patch, rollbackOnError: true, revalidate: false }
      );
    } catch (err) {
      toast({
        title: tc("error"),
        description: err instanceof Error ? err.message : t("saveFailed"),
        variant: "error",
      });
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <SettingsSection
      icon={Workflow}
      title={t("workflowTitle")}
      description={t("workflowHelp")}
    >
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              {t("phasesLabel")}
            </h3>
          </div>
          <div className="flex flex-col">
            {phases.map((phase) => {
              const isLastEnabled = phase.enabled && enabledPhaseCount <= 1;
              return (
                <ToggleRow
                  key={phase.id}
                  label={phase.name}
                  checked={phase.enabled}
                  disabled={isLastEnabled}
                  pending={pendingId === phase.id}
                  lockedHint={isLastEnabled ? t("lastPhaseHint") : undefined}
                  onChange={(checked) =>
                    toggle("phases", phase.id, checked, () =>
                      projects.setPhaseEnabled(projectId, phase.id, checked)
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              {t("stepsLabel")}
            </h3>
          </div>
          {steps.length === 0 ? (
            <SettingsEmpty
              icon={ListChecks}
              title={t("stepsEmptyTitle")}
              description={t("stepsEmptyDescription")}
            />
          ) : (
            <div className="flex flex-col">
              {liveSteps.map((step) => {
                const isDesign = step.name === "Design";
                return (
                  <ToggleRow
                    key={step.id}
                    label={step.name}
                    checked={step.enabled}
                    disabled={isDesign}
                    pending={pendingId === step.id}
                    lockedHint={isDesign ? t("designStepHint") : undefined}
                    onChange={(checked) =>
                      toggle("steps", step.id, checked, () =>
                        projects.setStepEnabled(projectId, step.id, checked)
                      )
                    }
                  />
                );
              })}

              {comingSoonSteps.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-border-default pt-3">
                  {comingSoonSteps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="text-sm text-text-muted">
                        {step.name}
                      </span>
                      <Badge variant="draft">{t("comingSoon")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </SettingsSection>
  );
}

/** Workflow stages with a real tab today; the rest are label-only. */
const LIVE_STEP_NAMES = new Set(["Design", "BOQ", "Order"]);
