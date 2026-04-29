"use client";

import { useTranslations } from "next-intl";
import { BOQ_ITEM_SOURCES, type BoqItemSource } from "@/lib/validations";
import { SOURCE_DISPLAY } from "../_lib/sources";

interface BoqSourceFilterProps {
  selected: ReadonlySet<BoqItemSource>;
  onChange: (next: Set<BoqItemSource>) => void;
}

/** Multi-toggle filter chips for the BOQ row provenance column. */
export function BoqSourceFilter({ selected, onChange }: BoqSourceFilterProps) {
  const t = useTranslations("boq.table");
  const allActive = selected.size === 0;

  const toggle = (src: BoqItemSource) => {
    const next = new Set(selected);
    if (next.has(src)) next.delete(src);
    else next.add(src);
    onChange(next);
  };

  return (
    <div
      className="flex items-center gap-2 flex-wrap text-xs"
      role="group"
      aria-label={t("filterBySource")}
    >
      <span className="text-text-muted">{t("filterBySource")}:</span>
      <button
        type="button"
        onClick={() => onChange(new Set())}
        aria-pressed={allActive}
        className={`rounded-full px-2.5 py-1 cursor-pointer transition-colors ${
          allActive
            ? "bg-accent text-accent-foreground"
            : "bg-bg-elevated text-text-primary hover:bg-bg-elevated/80"
        }`}
      >
        {t("filterAll")}
      </button>
      {BOQ_ITEM_SOURCES.map((src) => {
        const active = selected.has(src);
        return (
          <button
            key={src}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(src)}
            className={`rounded-full px-2.5 py-1 cursor-pointer transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "bg-bg-elevated text-text-primary hover:bg-bg-elevated/80"
            }`}
          >
            {t(SOURCE_DISPLAY[src].i18nKey)}
          </button>
        );
      })}
    </div>
  );
}
