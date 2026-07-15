"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { toast } from "@/components/ui/useToast";
import { projects } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { lineIncrementSchema, type ElementUnit } from "@/lib/validations";
import { DEFAULT_CURRENCY, DEFAULT_ELEMENT_UNIT } from "@/lib/constants";

interface ProjectBoqSettings {
  line_increment: number;
  default_currency: string | null;
  default_unit: string | null;
  default_vat_pct: string | null;
  default_contingency_pct: string | null;
  default_min_margin_pct: string | null;
  default_service_charge_pct: string | null;
}

/** Empty input → null (fall back to the global default); a number → that value. */
const pctOrNull = (s: string): number | null =>
  s.trim() === "" ? null : Number(s);
const numStr = (n: string | null): string => (n == null ? "" : String(n));

/** Per-project BOQ settings: line numbering + defaults that pre-fill new BOQs/items. */
export function ProjectBoqSettingsSection({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("projectSettings");
  const tc = useTranslations("common");
  const { data: project, isLoading } = useSWR<ProjectBoqSettings>(
    API.project(projectId)
  );

  const [increment, setIncrement] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [unit, setUnit] = useState<ElementUnit>(
    DEFAULT_ELEMENT_UNIT as ElementUnit
  );
  const [vat, setVat] = useState("");
  const [contingency, setContingency] = useState("");
  const [minMargin, setMinMargin] = useState("");
  const [serviceCharge, setServiceCharge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setIncrement(String(project.line_increment));
    setCurrency(project.default_currency ?? DEFAULT_CURRENCY);
    setUnit((project.default_unit ?? DEFAULT_ELEMENT_UNIT) as ElementUnit);
    setVat(numStr(project.default_vat_pct));
    setContingency(numStr(project.default_contingency_pct));
    setMinMargin(numStr(project.default_min_margin_pct));
    setServiceCharge(numStr(project.default_service_charge_pct));
  }, [project]);

  async function handleSave() {
    const inc = lineIncrementSchema.safeParse(Number(increment));
    if (!inc.success) {
      toast({
        title: t("incrementInvalidTitle"),
        description: t("incrementInvalidDescription"),
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await projects.update(projectId, {
        lineIncrement: inc.data,
        defaultCurrency: currency,
        defaultUnit: unit,
        defaultVatPct: pctOrNull(vat),
        defaultContingencyPct: pctOrNull(contingency),
        defaultMinMarginPct: pctOrNull(minMargin),
        defaultServiceChargePct: pctOrNull(serviceCharge),
      });
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const pctInput = (
    label: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <Input
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder={t("usesGlobalDefault")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("lineIncrementLabel")}
            </h3>
            <p className="text-xs text-text-muted">{t("lineIncrementHelp")}</p>
          </div>
          <Input
            type="number"
            min={2}
            max={1000}
            step={1}
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
            className="w-32"
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("boqDefaultsLabel")}
            </h3>
            <p className="text-xs text-text-muted">{t("boqDefaultsHelp")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencySelect
              label={t("defaultCurrency")}
              value={currency}
              onChange={setCurrency}
            />
            <UnitSelect
              label={t("defaultUnit")}
              value={unit}
              onChange={setUnit}
            />
            {pctInput(t("defaultVat"), vat, setVat)}
            {pctInput(t("defaultContingency"), contingency, setContingency)}
            {pctInput(t("defaultMinMargin"), minMargin, setMinMargin)}
            {pctInput(
              t("defaultServiceCharge"),
              serviceCharge,
              setServiceCharge
            )}
          </div>
        </div>
      </Card>

      <div>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      </div>
    </div>
  );
}
