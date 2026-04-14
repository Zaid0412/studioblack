"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  ArrowDown,
  Lock,
  Mail,
  Loader2,
  CheckCircle2,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";

/** Full-page email change verification — user confirms with password after clicking the email link. */
export default function VerifyEmailChangePage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const oldEmail = searchParams.get("oldEmail") ?? "";
  const newEmail = searchParams.get("newEmail") ?? "";
  const { mode, toggleTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/settings/verify-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || t("changeEmailVerifyError"));
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/settings"), 3000);
    } catch {
      setErrorMsg(t("changeEmailVerifyError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-6">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
        aria-label="Toggle theme"
      >
        {mode === "dark" ? (
          <Sun className="w-[18px] h-[18px] text-text-muted" />
        ) : (
          <Moon className="w-[18px] h-[18px] text-text-muted" />
        )}
      </button>

      {success ? (
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
          <p className="text-sm text-text-muted">
            {t("changeEmailSuccessDesc")}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-[440px] rounded-2xl border border-border-default bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:bg-bg-secondary dark:shadow-lg overflow-hidden">
          {/* Top section — icon, title, email pills */}
          <div className="flex flex-col items-center gap-5 px-8 pt-10 pb-7 bg-gradient-to-b from-accent/40 dark:from-accent/5 to-transparent">
            <div className="w-12 h-12 rounded-[14px] bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] font-bold text-text-primary">
                {t("changeEmailTitle")}
              </h1>
              <p className="text-sm text-text-muted mt-1.5">
                {t("changeEmailDesc")}
              </p>
            </div>

            {/* Email transition pills */}
            {(oldEmail || newEmail) && (
              <div className="flex flex-col items-center gap-0">
                {oldEmail && (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-primary/50 border border-border-default">
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-[13px] text-text-muted">
                      {oldEmail}
                    </span>
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
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border-default" />

          {/* Bottom section — password form */}
          <div className="px-8 pt-6 pb-8">
            {!token ? (
              <p className="text-sm text-error text-center">
                {t("changeEmailExpired")}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label={t("password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="current-password"
                />

                {errorMsg && <p className="text-sm text-error">{errorMsg}</p>}

                <Button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full h-[48px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("changeEmailConfirm")}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {t("changeEmailConfirm")}
                    </>
                  )}
                </Button>

                <p className="text-xs text-text-muted text-center">
                  {t("changeEmailHint")}
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
