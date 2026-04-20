"use client";

import { useState } from "react";
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

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

interface CategoryColorPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}

export function CategoryColorPicker({
  value,
  onChange,
  label,
}: CategoryColorPickerProps) {
  const isPreset = value != null && (PRESETS as readonly string[]).includes(value);
  const [hex, setHex] = useState<string>(value && !isPreset ? value : "");

  const commitHex = (raw: string) => {
    const normalised = raw.startsWith("#") ? raw : `#${raw}`;
    if (HEX_RE.test(normalised)) {
      onChange(normalised.toLowerCase());
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
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
                "relative h-7 w-7 rounded-full border border-border-default transition-transform",
                selected && "ring-2 ring-offset-2 ring-offset-bg-secondary",
                !selected && "hover:scale-110"
              )}
              style={{
                backgroundColor: c,
                // @ts-expect-error -- CSS custom property for ring color
                "--tw-ring-color": c,
              }}
            >
              {selected && (
                <Check
                  className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
        <input
          type="text"
          inputMode="text"
          placeholder="#RRGGBB"
          value={hex}
          maxLength={7}
          onChange={(e) => setHex(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitHex((e.target as HTMLInputElement).value);
            }
          }}
          className="h-7 w-24 rounded-md border border-border-default bg-bg-input px-2 text-[12px] text-text-primary outline-none focus:border-accent"
          aria-label="Custom hex color"
        />
      </div>
    </div>
  );
}
