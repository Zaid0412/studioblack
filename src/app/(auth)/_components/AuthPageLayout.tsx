"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/authClient";
import { getSafeReturnTo } from "@/lib/utils";
import { AlreadySignedIn } from "./AlreadySignedIn";

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
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { data: session } = authClient.useSession();

  // Redirect authenticated users
  useEffect(() => {
    if (!session?.user) return;
    const destination = getSafeReturnTo(returnTo);
    if (redirectDelay > 0) {
      const timeout = setTimeout(() => {
        router.push(destination);
      }, redirectDelay);
      return () => clearTimeout(timeout);
    }
    router.push(destination);
  }, [session?.user, router, redirectDelay, returnTo]);

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
            <AlreadySignedIn />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
