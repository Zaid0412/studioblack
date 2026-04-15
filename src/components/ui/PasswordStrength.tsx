"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
}

function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const COLORS = [
  "bg-error",
  "bg-error",
  "bg-warning",
  "bg-success",
  "bg-success",
];

/** Visual password strength meter with colored bars and label. */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth");
  const strength = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  const labels = [
    t("strengthWeak"),
    t("strengthWeak"),
    t("strengthFair"),
    t("strengthGood"),
    t("strengthStrong"),
  ];

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              i < strength ? COLORS[strength] : "bg-border-default"
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-text-muted">{labels[strength]}</span>
    </div>
  );
}
