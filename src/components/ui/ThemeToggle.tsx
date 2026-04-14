"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

/** Floating theme toggle button for standalone (non-dashboard) pages. */
export function ThemeToggle({
  className = "absolute top-4 right-4",
}: {
  className?: string;
}) {
  const { mode, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={`${className} p-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer`}
      aria-label="Toggle theme"
    >
      {mode === "dark" ? (
        <Sun className="w-[18px] h-[18px] text-text-muted" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-text-muted" />
      )}
    </button>
  );
}
