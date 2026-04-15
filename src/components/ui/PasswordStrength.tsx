"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface PasswordStrengthProps {
  password: string;
}

/** Count how many of the 4 requirements the password meets. */
function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

/** Segmented bar color per strength level (0–4 met). */
function barColor(strength: number): string {
  if (strength <= 1) return "bg-error";
  if (strength <= 2) return "bg-warning";
  return "bg-success";
}

/** Label text color per strength level. */
function labelColor(strength: number): string {
  if (strength <= 1) return "text-error";
  if (strength <= 2) return "text-warning";
  return "text-success";
}

/** Segmented password strength indicator — always visible, zero layout shift. */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth");
  const strength = useMemo(() => getStrength(password), [password]);

  const strings = useMemo(
    () => ({
      labels: [
        t("strengthWeak"),
        t("strengthWeak"),
        t("strengthFair"),
        t("strengthGood"),
        t("strengthStrong"),
      ],
      tooShort: t("passwordTooShort"),
    }),
    [t]
  );

  const isEmpty = !password;
  const tooShort = !!password && password.length < 8;
  const label = tooShort ? strings.tooShort : strings.labels[strength];
  const lColor = tooShort ? "text-error" : labelColor(strength);

  return (
    <div
      className={`flex flex-col gap-1 mt-1.5 transition-opacity duration-200 ${
        isEmpty ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={isEmpty}
    >
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i < strength ? barColor(strength) : "bg-border-default"
            }`}
          />
        ))}
      </div>
      <span className={`text-[11px] transition-colors duration-200 ${lColor}`}>
        {label}
      </span>
    </div>
  );
}
