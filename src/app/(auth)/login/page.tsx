"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { features } from "@/config/features";
import { authClient } from "@/lib/authClient";
import { getSafeReturnTo } from "@/lib/utils";
import { AuthPageLayout } from "../_components/AuthPageLayout";

/** Login page with email/password and optional magic-link. */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const forgotPasswordHref = useMemo(() => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (returnTo) params.set("returnTo", returnTo);
    const qs = params.toString();
    return `/forgot-password${qs ? `?${qs}` : ""}`;
  }, [email, returnTo]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      // 403 = email not verified (requireEmailVerification is enabled)
      if (error.status === 403) {
        setIsLoading(false);
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setErrorMsg(t("invalidCredentials"));
      setIsLoading(false);
      return;
    }

    router.push(getSafeReturnTo(returnTo));
  };

  return (
    <AuthPageLayout>
      <h2 className="text-2xl font-bold text-text-primary mb-2">
        {t("welcomeBack")}
      </h2>
      <p className="text-sm text-text-secondary mb-8">{t("signInSubtitle")}</p>

      <form onSubmit={handleSignIn} className="flex flex-col gap-5">
        <Input
          label={t("email")}
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <div>
          <Input
            label={t("password")}
            type="password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end mt-1.5">
            <Link
              href={forgotPasswordHref}
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </div>

        {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      {features.googleAuth && (
        <>
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border-default" />
            <span className="text-xs text-text-muted">
              {t("orContinueWith")}
            </span>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsGoogleLoading(true);
              await authClient.signIn.social({
                provider: "google",
                callbackURL: getSafeReturnTo(returnTo),
              });
            }}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium border border-border-default rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
          >
            <GoogleIcon className="w-5 h-5" />
            <span className="text-text-primary">Continue with Google</span>
          </button>
        </>
      )}

      {features.magicLink && (
        <>
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border-default" />
            <span className="text-xs text-text-muted">
              {t("orContinueWith")}
            </span>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          <Button variant="secondary" className="w-full" disabled={isLoading}>
            {t("magicLink")}
          </Button>
        </>
      )}

      <p className="text-sm text-text-muted text-center mt-8">
        {t("noAccount")}{" "}
        <Link
          href={
            returnTo
              ? `/register?returnTo=${encodeURIComponent(returnTo)}`
              : "/register"
          }
          className="text-accent hover:underline font-medium"
        >
          {t("signUpLink")}
        </Link>
      </p>
    </AuthPageLayout>
  );
}
