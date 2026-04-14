"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, RefreshCw, Loader2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";

/** Full-page email verification prompt shown after registration. */
export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const { mode, toggleTheme } = useTheme();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  const startCooldown = useCallback(() => {
    clearInterval(cooldownRef.current);
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResend = useCallback(async () => {
    if (!email) return;
    setResending(true);
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });
      toast({ title: t("verifyEmailResent"), variant: "success" });
      startCooldown();
    } catch {
      toast({ title: t("verifyEmailResendError"), variant: "error" });
    } finally {
      setResending(false);
    }
  }, [email, t, startCooldown]);

  const handleDifferentEmail = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // May not have a session — that's fine
    }
    router.push("/register");
  }, [router]);

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

      <div className="w-full max-w-[440px] rounded-2xl border border-border-default bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:bg-bg-secondary dark:shadow-lg overflow-hidden">
        {/* Top section — icon, title, email */}
        <div className="flex flex-col items-center gap-5 px-8 pt-10 pb-7 bg-gradient-to-b from-accent/40 dark:from-accent/5 to-transparent">
          <div className="w-12 h-12 rounded-[14px] bg-accent/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-accent" />
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-text-primary">
              {t("verifyEmailTitle")}
            </h1>
            <p className="text-sm text-text-muted mt-1.5">
              {t("verifyEmailDesc")}
            </p>
          </div>

          {/* Email pill */}
          {email && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <Mail className="w-3.5 h-3.5 text-accent" />
              <span className="text-[13px] font-semibold text-accent">
                {email}
              </span>
            </div>
          )}

          <p className="text-xs text-text-muted">{t("verifyEmailExpiry")}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-default" />

        {/* Bottom section — actions */}
        <div className="flex flex-col gap-3.5 px-8 pt-6 pb-8">
          <Button
            onClick={handleResend}
            disabled={resending || !email || cooldown > 0}
            className="w-full h-[48px]"
          >
            {resending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("verifyEmailResending")}
              </>
            ) : cooldown > 0 ? (
              t("verifyEmailCooldown", { seconds: cooldown })
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {t("verifyEmailResend")}
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            onClick={handleDifferentEmail}
            className="w-full h-[48px]"
          >
            {t("verifyEmailDifferent")}
          </Button>

          <p className="text-xs text-text-muted text-center mt-2">
            {t("verifyEmailSpamHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
