"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  ArrowDown,
  Lock,
  Mail,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthCard } from "@/components/ui/AuthCard";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api/client";

/** Full-page email change verification — user confirms with password or OTP after clicking the email link. */
export default function VerifyEmailChangePage() {
  const t = useTranslations("auth");
  const tSettings = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // OTP state for Google-only users
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Fetch pending change info from API (no emails in URL)
  useEffect(() => {
    if (!token) return;
    apiGet<{ oldEmail: string; newEmail: string; hasPassword: boolean }>(
      `/api/settings/verify-email-change?token=${token}`
    )
      .then((data) => {
        setOldEmail(data.oldEmail);
        setNewEmail(data.newEmail);
        setHasPassword(data.hasPassword);
      })
      .catch(() => {
        // Token invalid/expired — will be caught by the form submission too
      });
  }, [token]);

  // Cleanup redirect timer on unmount
  useEffect(() => {
    return () => clearTimeout(redirectTimer.current);
  }, []);

  const sendOtp = async () => {
    setIsSendingOtp(true);
    try {
      await apiPut("/api/settings/verify-email-change", { token });
      setOtpSent(true);
      setOtpCooldown(60);
    } catch {
      setErrorMsg(tSettings("otpSendError"));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usingOtp = hasPassword === false;
    if (!token || (usingOtp ? otpCode.length !== 6 : !password)) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const body = usingOtp
        ? { token, otp: otpCode }
        : { token, password };
      const data = await apiPost<{ newEmail: string }>(
        "/api/settings/verify-email-change",
        body
      );
      setNewEmail(data.newEmail);
      setSuccess(true);
      redirectTimer.current = setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(t("changeEmailVerifyError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Success state has a different layout — can't use AuthCard
  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-6">
        <ThemeToggle />
        <div className="w-full max-w-[440px] rounded-2xl border border-border-default bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:bg-bg-secondary dark:shadow-lg p-12 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary text-center">
            {t("changeEmailSuccess")}
          </h1>
          {newEmail && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <Mail className="w-3.5 h-3.5 text-accent" />
              <span className="text-sm font-semibold text-accent">
                {newEmail}
              </span>
            </div>
          )}
          <p className="text-sm text-text-muted text-center">
            {hasPassword === false
              ? t("changeEmailSuccessDescGoogle")
              : t("changeEmailSuccessDesc")}
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-[48px] mt-2"
          >
            <ArrowRight className="w-4 h-4" />
            {t("continueToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      icon={ShieldCheck}
      title={t("changeEmailTitle")}
      description={hasPassword === false ? t("changeEmailDescOtp") : t("changeEmailDesc")}
      headerExtra={
        oldEmail || newEmail ? (
          <div className="flex flex-col items-center gap-0">
            {oldEmail && (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-primary/50 border border-border-default">
                <Mail className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[13px] text-text-muted">{oldEmail}</span>
              </div>
            )}
            {oldEmail && newEmail && (
              <div className="w-8 h-8 flex items-center justify-center">
                <ArrowDown className="w-4 h-4 text-accent" />
              </div>
            )}
            {newEmail && (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
                <Mail className="w-3.5 h-3.5 text-accent" />
                <span className="text-[13px] font-semibold text-accent">
                  {newEmail}
                </span>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      {!token ? (
        <p className="text-sm text-error text-center">
          {t("changeEmailExpired")}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <input
            type="email"
            value={newEmail}
            autoComplete="username"
            readOnly
            hidden
          />

          {hasPassword === null ? (
            /* Still loading — don't show either form yet */
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : hasPassword === false ? (
            /* Google-only user: OTP verification */
            <div className="flex flex-col gap-3">
              {!otpSent ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-[48px]"
                  onClick={sendOtp}
                  disabled={isSendingOtp}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isSendingOtp
                    ? tSettings("sending")
                    : tSettings("sendVerificationCode")}
                </Button>
              ) : (
                <>
                  <Input
                    label={tSettings("verificationCode")}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, ""))
                    }
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={otpCooldown > 0 || isSendingOtp}
                    className="text-xs text-text-muted hover:text-accent transition-colors self-start cursor-pointer disabled:opacity-50"
                  >
                    {otpCooldown > 0
                      ? tSettings("resendIn", { seconds: otpCooldown })
                      : tSettings("resendCode")}
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Password user: password verification */
            <Input
              label={t("password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              autoComplete="current-password"
            />
          )}

          {errorMsg && <p className="text-sm text-error">{errorMsg}</p>}

          <Button
            type="submit"
            disabled={
              isLoading ||
              (hasPassword === false
                ? !otpSent || otpCode.length !== 6
                : !password)
            }
            className="w-full h-[48px]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {t("changeEmailConfirm")}
          </Button>

          <p className="text-xs text-text-muted text-center">
            {t("changeEmailHint")}
          </p>
        </form>
      )}
    </AuthCard>
  );
}
