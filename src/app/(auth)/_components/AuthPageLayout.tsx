"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/authClient";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  /** Delay in ms before redirecting authenticated users. Default: 0 (immediate). */
  redirectDelay?: number;
}

/**
 * Shared layout for auth pages (login, register).
 * Renders the two-column layout with hero panel, mobile logo,
 * and "already signed in" redirect state.
 */
export function AuthPageLayout({
  children,
  redirectDelay = 0,
}: AuthPageLayoutProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Redirect authenticated users
  useEffect(() => {
    if (!session?.user) return;
    if (redirectDelay > 0) {
      const timeout = setTimeout(() => {
        router.push("/dashboard");
      }, redirectDelay);
      return () => clearTimeout(timeout);
    }
    router.push("/dashboard");
  }, [session?.user, router, redirectDelay]);

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

      {/* Form Panel — Right */}
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
            children
          )}
        </div>
      </div>
    </div>
  );
}
