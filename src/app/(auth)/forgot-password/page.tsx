"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/authClient";
import { AuthPageLayout } from "../_components/AuthPageLayout";

const RESEND_COOLDOWN = 60;

/** Forgot password page — sends a reset link to the user's email. */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  const returnTo = searchParams.get("returnTo");

  const [email, setEmail] = useState(prefillEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendResetLink = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (error) {
      setErrorMsg(t("resetRequestError"));
      setIsLoading(false);
      return;
    }

    setSent(true);
    setCooldown(RESEND_COOLDOWN);
    setIsLoading(false);
  }, [email, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetLink();
  };

  return (
    <AuthPageLayout>
      <h2 className="text-2xl font-bold text-text-primary mb-2">
        {t("forgotPasswordTitle")}
      </h2>
      <p className="text-sm text-text-secondary mb-8">
        {t("forgotPasswordSubtitle")}
      </p>

      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">{t("resetEmailSent")}</p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={cooldown > 0 || isLoading}
            onClick={sendResetLink}
          >
            {cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : isLoading
                ? t("sendingResetLink")
                : t("resendResetLink")}
          </Button>
          <Link
            href={
              returnTo
                ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                : "/login"
            }
            className="text-sm text-accent-strong hover:underline font-medium text-center"
          >
            {t("backToLogin")}
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label={t("email")}
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            {errorMsg && (
              <p className="text-sm text-error" role="alert">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? t("sendingResetLink") : t("sendResetLink")}
            </Button>
          </form>

          <p className="text-sm text-text-muted text-center mt-8">
            {t("rememberPassword")}{" "}
            <Link
              href={
                returnTo
                  ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                  : "/login"
              }
              className="text-accent-strong hover:underline font-medium"
            >
              {t("signInLink")}
            </Link>
          </p>
        </>
      )}
    </AuthPageLayout>
  );
}
