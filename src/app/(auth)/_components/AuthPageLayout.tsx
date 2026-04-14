"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/authClient";
import { getSafeReturnTo } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  /** Delay in ms before redirecting authenticated users. Default: 0 (immediate). */
  redirectDelay?: number;
}

/**
 * Shared layout for auth pages (login, register, forgot/reset password).
 * Two-column split: hero panel left, form right.
 * Styled to match the landing page visual language.
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
    <div className="flex min-h-screen">
      {/* Hero Panel — Left */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-bg-secondary overflow-hidden">
        {/* Radial glow — matching landing hero */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-6 pt-3 w-full">
          {/* Top — logo */}
          <Link href="/" className="flex items-center -ml-3">
            <BrandLogo size="lg" />
          </Link>

          {/* Center — hero text */}
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-default bg-bg-primary/50 text-xs font-medium text-text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Built for architecture firms
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight mb-4">
              {t("heroTagline")}
            </h1>
            <p className="text-sm text-text-muted leading-relaxed max-w-sm">
              {t("heroSubtitle")}
            </p>
          </div>

          {/* Bottom — back to home */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to home</span>
          </Link>
        </div>
      </div>

      {/* Form Panel — Right */}
      <div className="flex-1 relative flex flex-col bg-bg-primary">
        {/* Top bar — mobile logo + theme toggle */}
        <div className="flex items-center justify-between px-6 py-4 lg:justify-end">
          <Link href="/" className="flex items-center lg:hidden">
            <BrandLogo size="lg" />
          </Link>
          <ThemeToggle className="relative" />
        </div>

        {/* Form — vertically centered */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-sm">
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

        {/* Mobile back to home */}
        <div className="lg:hidden text-center pb-6">
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
