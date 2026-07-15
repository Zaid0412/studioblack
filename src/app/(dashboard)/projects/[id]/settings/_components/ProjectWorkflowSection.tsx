"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate } from "swr";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { DbPhase, DbStep } from "@/types";

interface ProjectWorkflowData {
  phases: DbPhase[];
  steps: DbStep[];
}

/** Per-project Phases & Workflow visibility — toggling hides the tab/stepper entry, never the data. */
export function ProjectWorkflowSection({ projectId }: { projectId: string }) {
  const t = useTranslations("projectSettings");
  const tc = useTranslations("common");
  const { data: project, isLoading } = useSWR<ProjectWorkflowData>(
    API.project(projectId)
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  const phases = project?.phases ?? [];
  const steps = project?.steps ?? [];
  const enabledPhaseCount = phases.filter((p) => p.enabled).length;

  async function togglePhase(phase: DbPhase, enabled: boolean) {
    setPendingId(phase.id);
    try {
      await projects.setPhaseEnabled(projectId, phase.id, enabled);
      await mutate(API.project(projectId));
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

  async function toggleStep(step: DbStep, enabled: boolean) {
    setPendingId(step.id);
    try {
      await projects.setStepEnabled(projectId, step.id, enabled);
      await mutate(API.project(projectId));
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-text-primary">
          {t("workflowTitle")}
        </h2>
        <p className="text-xs text-text-muted">{t("workflowHelp")}</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("phasesLabel")}
          </h3>
          <div className="flex flex-col gap-3">
            {phases.map((phase) => {
              const isLastEnabled = phase.enabled && enabledPhaseCount <= 1;
              return (
                <div key={phase.id} className="flex flex-col gap-1">
                  <ToggleSwitch
                    checked={phase.enabled}
                    onChange={(checked) => togglePhase(phase, checked)}
                    label={phase.name}
                    disabled={pendingId === phase.id || isLastEnabled}
                  />
                  {isLastEnabled && (
                    <p className="text-xs text-text-muted">
                      {t("lastPhaseHint")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("stepsLabel")}
          </h3>
          <div className="flex flex-col gap-3">
            {steps.map((step) => {
              const isDesign = step.name === "Design";
              return (
                <div key={step.id} className="flex flex-col gap-1">
                  <ToggleSwitch
                    checked={step.enabled}
                    onChange={(checked) => toggleStep(step, checked)}
                    label={step.name}
                    disabled={pendingId === step.id || isDesign}
                  />
                  {isDesign && (
                    <p className="text-xs text-text-muted">
                      {t("designStepHint")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
