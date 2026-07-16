"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/useToast";
import { categoryCodeConfig as configApi } from "@/lib/api";
import { useCodeConfig } from "@/hooks/useCodeConfig";
import type { CategoryCodeConfig } from "@/types";

/** One label + description + control row. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-default py-3 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">{hint}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Org settings → Coding: how element-category (Category / Sub-Category / Service
 * Area) codes are generated. PM-only. Mirrors the DivisionsSection data flow.
 */
export function CodingSection() {
  const t = useTranslations("coding");
  const tc = useTranslations("common");
  const { config, isLoading, loaded, mutate } = useCodeConfig();

  async function patch(fields: Partial<Record<string, unknown>>) {
    try {
      const { config: next } = await configApi.update(fields);
      await mutate({ config: next }, { revalidate: false });
    } catch (err) {
      toast({
        title: tc("error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      await mutate();
    }
  }

  const toggle = (
    field: keyof CategoryCodeConfig,
    apiKey: string,
    value: boolean
  ) => patch({ [apiKey]: value });

  if (isLoading && !loaded) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text-primary">
          {t("title")}
        </h2>
        <p className="text-sm text-text-muted">{t("help")}</p>
      </div>

      <Card>
        <Row label={t("autoGenerate")} hint={t("autoGenerateHint")}>
          <ToggleSwitch
            checked={config.auto_generate}
            onChange={(v) => toggle("auto_generate", "autoGenerate", v)}
          />
        </Row>

        <Row label={t("maxLength")} hint={t("maxLengthHint")}>
          <Select
            value={String(config.code_max_length)}
            onValueChange={(v) => patch({ codeMaxLength: Number(v) })}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label={t("forceUppercase")} hint={t("forceUppercaseHint")}>
          <ToggleSwitch
            checked={config.force_uppercase}
            onChange={(v) => toggle("force_uppercase", "forceUppercase", v)}
          />
        </Row>

        <Row label={t("preventDuplicates")} hint={t("preventDuplicatesHint")}>
          <ToggleSwitch
            checked={config.prevent_duplicates}
            onChange={(v) =>
              toggle("prevent_duplicates", "preventDuplicates", v)
            }
          />
        </Row>

        <Row label={t("lockAfterUse")} hint={t("lockAfterUseHint")}>
          <ToggleSwitch
            checked={config.lock_after_use}
            onChange={(v) => toggle("lock_after_use", "lockAfterUse", v)}
          />
        </Row>
      </Card>
    </div>
  );
}
