"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { authClient } from "@/lib/authClient";
import { features } from "@/config/features";
import { getSafeReturnTo } from "@/lib/utils";
import { AuthPageLayout } from "../_components/AuthPageLayout";

/** Registration page with name, email, and password fields. */
export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitationId");
  const inviteEmail = searchParams.get("email");
  const returnTo = searchParams.get("returnTo");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Client-side validation
    if (password.length < 8) {
      setErrorMsg(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("exist")) {
        setErrorMsg(t("emailInUse"));
      } else {
        setErrorMsg(t("registrationError"));
      }
      setIsLoading(false);
      return;
    }

    // If there's a pending invitation, accept it automatically
    if (invitationId) {
      try {
        await authClient.organization.acceptInvitation({
          invitationId,
        });
      } catch {
        // Invitation may have expired or been cancelled — continue anyway
        console.warn("Could not auto-accept invitation");
      }
    }

    // Redirect to email verification page or dashboard
    if (features.emailVerification) {
      // Fire-and-forget: sendOnSignUp handles prod, this is a dev fallback
      authClient
        .sendVerificationEmail({ email, callbackURL: "/dashboard" })
        .catch(() => console.warn("Could not send verification email"));
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } else {
      router.push(getSafeReturnTo(returnTo));
    }
  };

  return (
    <AuthPageLayout redirectDelay={2000}>
      <h2 className="text-2xl font-bold text-text-primary mb-1">
        {t("createAccount")}
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        {t("createAccountSubtitle")}
      </p>

      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <Input
          label={t("fullName")}
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
        <Input
          label={t("email")}
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          readOnly={!!inviteEmail}
          className={inviteEmail ? "opacity-60 cursor-not-allowed" : ""}
          required
        />
        <Input
          label={t("password")}
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

        {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

        <Button type="submit" className="w-full mt-1" disabled={isLoading}>
          {isLoading ? t("signingUp") : t("signUp")}
        </Button>
      </form>

      {features.googleAuth && !inviteEmail && (
        <>
          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-border-default" />
            <span className="text-xs text-text-muted">or</span>
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

      <p className="text-sm text-text-muted text-center mt-6">
        {t("haveAccount")}{" "}
        <Link
          href={
            returnTo
              ? `/login?returnTo=${encodeURIComponent(returnTo)}`
              : "/login"
          }
          className="text-accent hover:underline font-medium"
        >
          {t("signInLink")}
        </Link>
      </p>
    </AuthPageLayout>
  );
}
