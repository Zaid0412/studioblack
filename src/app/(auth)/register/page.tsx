"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/ui/brand-logo";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/auth-client";

/** Registration page with name, email, and password fields. */
export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Client-side validation: passwords must match
    if (password !== confirmPassword) {
      setErrorMsg(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    const { data, error } = await authClient.signUp.email({
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

    // Sign-up creates a session — redirect based on role
    if (data?.user?.role === "client") {
      router.push("/client-dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Hero Panel — Left */}
      <div className="hidden lg:flex lg:flex-[1.8] relative bg-bg-secondary overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-secondary via-bg-secondary to-accent/5" />

        {/* Branding content at bottom */}
        <div className="relative z-10 flex flex-col justify-end p-16 pb-20">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <BrandLogo size="md" />
            <span className="text-lg font-semibold text-text-primary">
              {branding.appName}
            </span>
          </div>

          {/* Hero text */}
          <h1 className="text-[40px] font-bold text-text-primary leading-tight mb-4">
            {t("heroTagline")}
          </h1>
          <p className="text-base text-text-muted max-w-md">
            {t("heroSubtitle")}
          </p>
        </div>
      </div>

      {/* Register Form — Right */}
      <div className="flex-1 flex items-center justify-center bg-bg-primary px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <BrandLogo size="sm" />
            <span className="text-base font-semibold text-text-primary">
              {branding.appName}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">
            {t("createAccount")}
          </h2>
          <p className="text-sm text-text-secondary mb-8">
            {t("createAccountSubtitle")}
          </p>

          <form onSubmit={handleSignUp} className="flex flex-col gap-5">
            <Input
              label={t("fullName")}
              type="text"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={t("email")}
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label={t("password")}
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label={t("confirmPassword")}
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {errorMsg && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? t("signingUp") : t("signUp")}
            </Button>
          </form>

          <p className="text-sm text-text-muted text-center mt-8">
            {t("haveAccount")}{" "}
            <Link
              href="/login"
              className="text-accent hover:underline font-medium"
            >
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
