"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  "#c9a876",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#52525b",
] as const;

const DEFAULT_WHEEL_COLOR = "#c9a876";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

interface CategoryColorPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}

/**
 * Category color picker — react-colorful saturation + hue, hex input,
 * presets row, Clear button. Returns null when cleared.
 */
export function CategoryColorPicker({
  value,
  onChange,
  label,
}: CategoryColorPickerProps) {
  const tCommon = useTranslations("common");
  const [hexInput, setHexInput] = useState(value ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the input when value changes via the wheel or preset click
    setHexInput(value ?? "");
  }, [value]);

  const commitHex = (raw: string) => {
    const normalised = raw.startsWith("#") ? raw : `#${raw}`;
    if (HEX_RE.test(normalised)) {
      onChange(normalised.toLowerCase());
    } else if (raw === "") {
      onChange(null);
    } else {
      setHexInput(value ?? "");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}

      <div className="category-color-picker">
        <HexColorPicker
          color={value ?? DEFAULT_WHEEL_COLOR}
          onChange={(c) => onChange(c.toLowerCase())}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-md border border-border-default"
          style={{ backgroundColor: value ?? "transparent" }}
        />
        <input
          type="text"
          inputMode="text"
          placeholder="#RRGGBB"
          value={hexInput}
          maxLength={7}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitHex((e.target as HTMLInputElement).value);
            }
          }}
          className="h-8 flex-1 rounded-md border border-border-default bg-bg-input px-2 text-[12px] text-text-primary outline-none focus:border-accent"
          aria-label="Hex color"
        />
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-8 rounded-md border border-border-default bg-bg-input px-3 text-[12px] text-text-secondary hover:text-text-primary hover:border-accent/60"
          >
            {tCommon("clear")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((c) => {
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Select color ${c}`}
              aria-pressed={selected}
              className={cn(
                "relative h-6 w-6 rounded-full border border-border-default transition-transform",
                !selected && "hover:scale-110"
              )}
              style={{ backgroundColor: c }}
            >
              {selected && (
                <Check
                  className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
