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
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={document.documentElement.getAttribute("data-theme") === "dark" ? branding.logoUrl : (branding.logoUrlDark ?? branding.logoUrl)}
        alt=""
        width={branding.showLogoText ? 64 : 96}
        height={branding.showLogoText ? 64 : 96}
        className={branding.showLogoText ? "w-16 h-16 rounded-xl" : "h-40 w-40"}
      />

      {/* Animated dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--accent)] animate-[splash-dot_1.4s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
