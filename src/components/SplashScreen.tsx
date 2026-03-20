"use client";

import { useEffect, useState } from "react";
import { branding } from "@/config/branding";

/**
 * Full-screen splash overlay shown during initial page load.
 *
 * Renders a branded loading screen with animated logo that fades out
 * once React hydration completes. Pure CSS animations — no extra
 * network requests or blocking JS.
 */
export function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Fade out after hydration + small delay for smoothness
    const timer = setTimeout(() => setHidden(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Remove from DOM after fade-out transition completes
  useEffect(() => {
    if (!hidden) return;
    const timer = setTimeout(() => setRemoved(true), 500);
    return () => clearTimeout(timer);
  }, [hidden]);

  if (removed) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-primary)] transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1 }}
      aria-hidden="true"
    >
      {/* Logo with pulse animation */}
      <div className="animate-[splash-pulse_1.5s_ease-in-out_infinite]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logoUrl}
          alt=""
          width={64}
          height={64}
          className="rounded-xl"
        />
      </div>

      {/* Spinning ring around logo */}
      <div className="absolute w-[112px] h-[112px] rounded-full border-2 border-[#1A1A1A] border-t-[#F5C518] animate-[splash-spin_1.2s_linear_infinite]" />
    </div>
  );
}
