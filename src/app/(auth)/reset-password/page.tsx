"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/authClient";
import { AuthPageLayout } from "../_components/AuthPageLayout";

/** Reset password page — user arrives here from the email link with a token. */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const isInvalidToken = error === "INVALID_TOKEN" || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });

    if (resetError) {
      setErrorMsg(t("resetError"));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  return (
    <AuthPageLayout>
      {success ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-text-primary">
            {t("resetSuccessTitle")}
          </h2>
          <p className="text-sm text-text-secondary">{t("resetSuccess")}</p>
          <Link
            href="/login"
            className="text-sm text-accent-strong hover:underline font-medium"
          >
            {t("backToLogin")}
          </Link>
        </div>
      ) : isInvalidToken ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-text-primary">
            {t("resetTokenInvalidTitle")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t("resetTokenInvalid")}
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-accent-strong hover:underline font-medium"
          >
            {t("requestNewLink")}
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            {t("resetPasswordTitle")}
          </h2>
          <p className="text-sm text-text-secondary mb-8">
            {t("resetPasswordSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label={t("newPassword")}
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label={t("confirmPassword")}
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            {errorMsg && (
              <p className="text-sm text-error" role="alert">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? t("resettingPassword") : t("resetPassword")}
            </Button>
          </form>
        </>
      )}
    </AuthPageLayout>
  );
}
