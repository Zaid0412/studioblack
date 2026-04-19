"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/authClient";
import { getSafeReturnTo } from "@/lib/utils";
import { AlreadySignedIn } from "./AlreadySignedIn";

type Mode = "login" | "register" | "static";

interface AuthShellProps {
  mode: Mode;
  children: React.ReactNode;
  /** Delay in ms before redirecting authenticated users. Default: 0. */
  redirectDelay?: number;
}

// ---------------------------------------------------------------------------
// Hero panel — always dark, both themes
// ---------------------------------------------------------------------------

function HeroPanel() {
  const t = useTranslations("auth");

  return (
    <div
      className="absolute inset-0 flex overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0a0a0a 0%, #0f1729 50%, #1a0a2e 100%)",
      }}
    >
      <div className="relative z-10 flex flex-col justify-end p-16 pb-20">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#F5C518] flex items-center justify-center">
            <span className="text-lg font-bold text-[#0d0d0d]">
              {branding.appName.charAt(0)}
            </span>
          </div>
          {branding.showLogoText && (
            <span className="text-lg font-semibold text-white">
              {branding.appName}
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="text-[42px] font-extrabold text-white leading-tight mb-4">
          {t("heroTagline")}
        </h1>
        <p className="text-base text-[#a1a1aa] max-w-md">{t("heroSubtitle")}</p>

        {/* Gold accent line */}
        <div className="w-12 h-[3px] bg-[#F5C518] rounded-full mt-6" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form card wrapper
// ---------------------------------------------------------------------------

function FormCard({
  children,
  isLight,
}: {
  children: React.ReactNode;
  isLight: boolean;
}) {
  return (
    <div
      className={`
        w-full max-w-sm lg:p-8 lg:rounded-2xl
        ${
          isLight
            ? "lg:bg-white lg:border lg:border-[#e4e4e7] lg:shadow-[0_2px_20px_rgba(0,0,0,0.06)]"
            : "lg:bg-[rgba(255,255,255,0.03)] lg:border lg:border-[rgba(245,197,24,0.12)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        }
      `}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthShell — split-screen layout with slide animation
// ---------------------------------------------------------------------------

/**
 * Split-screen auth layout with hero panel and form card.
 * - "login"    → hero left (0%), form right (50%)
 * - "register" → hero right (50%), form left (0%)
 * - "static"   → same as login, no animation
 *
 * Uses absolute positioning with CSS `left` transitions for smooth sliding.
 * On mobile, hero is hidden and the form takes full width without transforms.
 */
export function AuthShell({
  mode,
  children,
  redirectDelay = 0,
}: AuthShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { data: session } = authClient.useSession();
  const { mode: themeMode } = useTheme();
  const isLight = themeMode === "light";
  const [hasRendered, setHasRendered] = useState(false);

  // Disable transition on first render to prevent slide-in on page load
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setHasRendered(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (!session?.user) return;
    const destination = getSafeReturnTo(returnTo);
    if (redirectDelay > 0) {
      const timeout = setTimeout(() => router.push(destination), redirectDelay);
      return () => clearTimeout(timeout);
    }
    router.push(destination);
  }, [session?.user, router, redirectDelay, returnTo]);

  const isRegister = mode === "register";
  const shouldAnimate = hasRendered && mode !== "static";

  // Already signed in state
  if (session?.user) {
    return (
      <div className="flex min-h-screen lg:h-screen bg-bg-primary">
        <div className="hidden lg:block lg:w-1/2 relative">
          <HeroPanel />
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <AlreadySignedIn />
        </div>
      </div>
    );
  }

  const transitionClass = shouldAnimate
    ? "transition-[left] duration-500 ease-in-out"
    : "";

  return (
    <div className="relative min-h-screen lg:h-screen overflow-hidden bg-bg-primary">
      <ThemeToggle className="absolute top-4 right-4 z-50" />

      {/* ---- Desktop: absolute-positioned sliding panels ---- */}

      {/* Hero panel */}
      <div
        className={`hidden lg:block absolute top-0 bottom-0 w-1/2 ${transitionClass}`}
        style={{ left: isRegister ? "50%" : "0%" }}
      >
        <HeroPanel />
      </div>

      {/* Form panel */}
      <div
        className={`hidden lg:flex absolute top-0 bottom-0 w-1/2 items-center justify-center ${transitionClass}`}
        style={{ left: isRegister ? "0%" : "50%" }}
      >
        <FormCard isLight={isLight}>
          <div key={mode} className="animate-[fadeIn_300ms_ease-in-out]">
            {children}
          </div>
        </FormCard>
      </div>

      {/* ---- Mobile: simple stacked layout, no animation ---- */}
      <div className="lg:hidden flex items-center justify-center min-h-screen px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 -ml-3 mb-6">
            <BrandLogo size="lg" />
            {branding.showLogoText && (
              <span className="text-base font-semibold text-text-primary">
                {branding.appName}
              </span>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
