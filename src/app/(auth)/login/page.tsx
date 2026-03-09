"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { branding } from "@/config/branding";
import { features } from "@/config/features";

/**
 * Renders the application logo — either an `<img>` when a `logoUrl` is
 * configured in branding, or a coloured square with the first letter of the
 * app name as a fallback.
 *
 * @param size - `"sm"` (32×32) for compact contexts, `"md"` (40×40) for the
 *   login hero panel.
 */
function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "sm" ? "text-base" : "text-lg";
  const rounded = size === "sm" ? "rounded-md" : "rounded-lg";

  return branding.logoUrl ? (
    <img
      src={branding.logoUrl}
      alt={branding.appName}
      className={`${dims} ${rounded} object-contain`}
    />
  ) : (
    <div
      className={`flex items-center justify-center ${dims} ${rounded} bg-accent`}
    >
      <span className={`${textSize} font-bold text-text-on-accent`}>
        {branding.appName.charAt(0)}
      </span>
    </div>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock auth — navigate to dashboard
    router.push("/dashboard");
  };

  const handleMagicLink = () => {
    // Mock magic link — navigate to dashboard
    router.push("/dashboard");
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

      {/* Login Form — Right */}
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
            {t("welcomeBack")}
          </h2>
          <p className="text-sm text-text-secondary mb-8">
            {t("signInSubtitle")}
          </p>

          <form onSubmit={handleSignIn} className="flex flex-col gap-5">
            <Input
              label={t("email")}
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={t("password")}
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" className="w-full mt-2">
              {t("signIn")}
            </Button>
          </form>

          {features.magicLink && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-border-default" />
                <span className="text-xs text-text-muted">
                  {t("orContinueWith")}
                </span>
                <div className="flex-1 h-px bg-border-default" />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={handleMagicLink}
              >
                {t("magicLink")}
              </Button>
            </>
          )}

          <p className="text-xs text-text-muted text-center mt-8">
            {t("clientHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
