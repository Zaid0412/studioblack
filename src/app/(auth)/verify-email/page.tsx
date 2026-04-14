"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/ui/AuthCard";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";

/** Full-page email verification prompt shown after registration. */
export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
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
    <AuthCard
      icon={Mail}
      title={t("verifyEmailTitle")}
      description={t("verifyEmailDesc")}
      headerExtra={
        <>
          {email && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <Mail className="w-3.5 h-3.5 text-accent" />
              <span className="text-[13px] font-semibold text-accent">
                {email}
              </span>
            </div>
          )}
          <p className="text-xs text-text-muted">{t("verifyEmailExpiry")}</p>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
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
    </AuthCard>
  );
}
