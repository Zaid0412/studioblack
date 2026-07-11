"use client";

import { useEffect, useState } from "react";

const SPLASH_GONE_EVENT = "splash-gone";

type SplashWindow = Window & { __splashGone?: boolean };

/** Called by SplashScreen once the overlay is removed. */
export function markSplashGone(): void {
  (window as SplashWindow).__splashGone = true;
  window.dispatchEvent(new Event(SPLASH_GONE_EVENT));
}

/**
 * True once the initial splash overlay has been removed. Auth entrance
 * animations gate on this so they don't play (invisibly) behind the splash on
 * first load — the splash covers the page for ~800ms, longer than the
 * animations run. On client navigations the splash is long gone, so this
 * resolves immediately.
 */
export function useSplashDone(): boolean {
  // Lazy init reads the flag synchronously — true only on client-only renders
  // (after a prior load's splash cleared), never during SSR/hydration, so no
  // mismatch. Keeps the effect free of a synchronous setState.
  const [done, setDone] = useState(
    () =>
      typeof window !== "undefined" &&
      (window as SplashWindow).__splashGone === true
  );

  useEffect(() => {
    if (done) return;
    const onGone = () => setDone(true);
    window.addEventListener(SPLASH_GONE_EVENT, onGone, { once: true });
    // Safety net: never leave content gated if the event is somehow missed.
    const fallback = setTimeout(() => setDone(true), 1500);
    return () => {
      window.removeEventListener(SPLASH_GONE_EVENT, onGone);
      clearTimeout(fallback);
    };
  }, [done]);

  return done;
}

/**
 * Class string for a splash-gated card entrance (fade + rise once visible,
 * hidden until then). Shared by the standalone auth card surfaces.
 */
export function useSplashRevealClass(): string {
  return useSplashDone()
    ? "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
    : "opacity-0 motion-reduce:opacity-100";
}
