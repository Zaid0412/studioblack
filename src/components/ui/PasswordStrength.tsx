"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { getStrength, barColor, labelColor } from "@/lib/passwordUtils";

interface PasswordStrengthProps {
  password: string;
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
