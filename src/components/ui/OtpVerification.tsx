"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OtpVerificationProps {
  otpSent: boolean;
  otpCode: string;
  setOtpCode: (value: string) => void;
  isSendingOtp: boolean;
  otpCooldown: number;
  onSendOtp: () => void;
  /** Button variant — "inline" for settings forms, "full" for standalone pages. */
  variant?: "inline" | "full";
}

/** OTP send + input + resend UI — used for identity verification flows. */
export function OtpVerification({
  otpSent,
  otpCode,
  setOtpCode,
  isSendingOtp,
  otpCooldown,
  onSendOtp,
  variant = "inline",
}: OtpVerificationProps) {
  const t = useTranslations("settings");
  const fullWidth = variant === "full";

  if (!otpSent) {
    return (
      <Button
        type="button"
        variant="secondary"
        className={fullWidth ? "w-full h-[48px]" : "self-start"}
        onClick={onSendOtp}
        disabled={isSendingOtp}
      >
        <Mail className="w-4 h-4 mr-2" />
        {isSendingOtp ? t("sending") : t("sendVerificationCode")}
      </Button>
    );
  }

  return (
    <>
      <Input
        label={t("verificationCode")}
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        value={otpCode}
        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
        autoComplete="one-time-code"
      />
      <button
        type="button"
        onClick={onSendOtp}
        disabled={otpCooldown > 0 || isSendingOtp}
        className="text-xs text-text-muted hover:text-accent transition-colors self-start cursor-pointer disabled:opacity-50"
      >
        {otpCooldown > 0
          ? t("resendIn", { seconds: otpCooldown })
          : t("resendCode")}
      </button>
    </>
  );
}
