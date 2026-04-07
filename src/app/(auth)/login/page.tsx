"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { authClient } from "@/lib/authClient";

/** Login page with email/password and optional magic-link. */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Redirect authenticated users after a brief delay
  useEffect(() => {
    if (!session?.user) return;
    router.push("/dashboard");
  }, [session?.user, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setErrorMsg(t("invalidCredentials"));
      setIsLoading(false);
      return;
    }

    // All roles go to /dashboard — layout adapts based on role
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen lg:h-screen">
      {/* Hero Panel — Left */}
      <div className="hidden lg:flex lg:flex-[1.8] relative bg-bg-secondary overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-bg-secondary via-bg-secondary to-accent/5" />

        {/* Branding content at bottom */}
        <div className="relative z-10 flex flex-col justify-end p-16 pb-20">
          {/* Logo */}
          <div className="flex items-center gap-3 -ml-5">
            <BrandLogo size="lg" />
            {branding.showLogoText && (
              <span className="text-lg font-semibold text-text-primary">
                {branding.appName}
              </span>
            )}
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
          <div
            className={`flex items-center gap-2.5 lg:hidden ${session?.user ? "justify-center" : "-ml-3"}`}
          >
            <BrandLogo size="lg" />
            {branding.showLogoText && (
              <span className="text-base font-semibold text-text-primary">
                {branding.appName}
              </span>
            )}
          </div>

          {session?.user ? (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <h2 className="text-2xl font-bold text-text-primary">
                {t("alreadySignedIn")}
              </h2>
              <p className="text-sm text-text-muted flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("redirecting")}
              </p>
            </div>
          ) : (
            <>
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
                  required
                />
                <Input
                  label={t("password")}
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? t("signingIn") : t("signIn")}
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
                    disabled={isLoading}
                  >
                    {t("magicLink")}
                  </Button>
                </>
              )}

              <p className="text-sm text-text-muted text-center mt-8">
                {t("noAccount")}{" "}
                <Link
                  href="/register"
                  className="text-accent hover:underline font-medium"
                >
                  {t("signUpLink")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
