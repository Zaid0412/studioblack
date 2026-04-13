"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, RefreshCw, Loader2, ArrowLeft, Sun, Moon } from "lucide-react";
import Link from "next/link";
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
    <div className="flex flex-col min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-default shrink-0">
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToLogin")}
        </Link>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {mode === "dark" ? (
            <Sun className="w-[18px] h-[18px] text-text-muted" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-text-muted" />
          )}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="flex flex-col items-center max-w-[420px] w-full">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-8">
            <Mail className="w-9 h-9 text-accent" />
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-bold text-text-primary text-center mb-3">
            {t("verifyEmailTitle")}
          </h1>

          {/* Description */}
          <p className="text-[15px] text-text-secondary text-center">
            {t("verifyEmailDesc")}
          </p>
          {email && (
            <p className="text-[15px] font-semibold text-text-primary text-center mt-1.5">
              {email}
            </p>
          )}
          <p className="text-[13px] text-text-muted text-center mt-2">
            {t("verifyEmailExpiry")}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3.5 w-full max-w-[360px] mt-9">
            <Button
              onClick={handleResend}
              disabled={resending || !email || cooldown > 0}
              className="w-full h-[46px]"
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
              className="w-full h-[46px]"
            >
              {t("verifyEmailDifferent")}
            </Button>
          </div>

          {/* Divider + hint */}
          <div className="w-full max-w-[360px] mt-8">
            <div className="border-t border-border-default mb-5" />
            <p className="text-[12px] text-text-muted text-center">
              {t("verifyEmailSpamHint")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
