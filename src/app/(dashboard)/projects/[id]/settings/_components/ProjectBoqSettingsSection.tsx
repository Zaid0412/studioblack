"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { lineIncrementSchema } from "@/lib/validations";

/** Per-project BOQ settings — currently just the line-number increment. */
export function ProjectBoqSettingsSection({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("projectSettings");
  const tc = useTranslations("common");
  const { data: project, isLoading } = useSWR<{ line_increment: number }>(
    API.project(projectId)
  );
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) setValue(String(project.line_increment));
  }, [project]);

  async function handleSave() {
    const parsed = lineIncrementSchema.safeParse(Number(value));
    if (!parsed.success) {
      toast({
        title: t("incrementInvalidTitle"),
        description: t("incrementInvalidDescription"),
        variant: "error",
      });
      return;
    }
    const n = parsed.data;
    setSaving(true);
    try {
      await projects.update(projectId, { lineIncrement: n });
      toast({ title: t("savedToast"), variant: "success" });
    } catch {
      toast({
        title: tc("error"),
        description: t("saveFailed"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("lineIncrementLabel")}
          </h3>
          <p className="text-xs text-text-muted">{t("lineIncrementHelp")}</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-40 rounded-lg" />
        ) : (
          <div className="flex items-end gap-3">
            <Input
              type="number"
              min={2}
              max={1000}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
            />
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="shrink-0"
            >
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
