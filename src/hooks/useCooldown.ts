import { useState, useEffect, useCallback } from "react";

/** Countdown timer hook. Returns [secondsLeft, startCooldown]. */
export function useCooldown(durationSeconds = 60) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const start = useCallback(() => {
    setCooldown(durationSeconds);
  }, [durationSeconds]);

  return [cooldown, start] as const;
}
