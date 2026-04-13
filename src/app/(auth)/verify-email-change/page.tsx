"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  ArrowLeft,
  Sun,
  Moon,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";

/** Full-page email change verification — user confirms with password after clicking the email link. */
export default function VerifyEmailChangePage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
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
    <div className="flex flex-col min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-default shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backToSettings")}
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
            {success ? (
              <CheckCircle2 className="w-9 h-9 text-accent" />
            ) : (
              <ShieldCheck className="w-9 h-9 text-accent" />
            )}
          </div>

          {success ? (
            <>
              <h1 className="text-[28px] font-bold text-text-primary text-center mb-3">
                {t("changeEmailSuccess")}
              </h1>
              <p className="text-[15px] text-text-secondary text-center">
                {t("changeEmailSuccessDesc")}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[28px] font-bold text-text-primary text-center mb-3">
                {t("changeEmailTitle")}
              </h1>
              <p className="text-[15px] text-text-secondary text-center mb-9">
                {t("changeEmailDesc")}
              </p>

              {!token ? (
                <p className="text-[15px] text-status-error text-center">
                  {t("changeEmailExpired")}
                </p>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4 w-full max-w-[360px]"
                >
                  <Input
                    label={t("password")}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                    autoComplete="current-password"
                  />

                  {errorMsg && (
                    <p className="text-sm text-status-error">{errorMsg}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !password}
                    className="w-full h-[46px]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("changeEmailConfirm")}
                      </>
                    ) : (
                      t("changeEmailConfirm")
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
