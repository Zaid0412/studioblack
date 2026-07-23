import type { Theme } from "./index";

/** Light theme — clean and bright alternative to StudioBlack. */
const lightTheme: Theme = {
  name: "StudioLight",
  colors: {
    // Backgrounds
    "bg-primary": "#FFFFFF",
    "bg-secondary": "#F5F5F5",
    "bg-elevated": "#EBEBEB",
    "bg-input": "#E0E0E0",

    // Accent
    accent: "#C9A30C",
    "accent-hover": "#B08E0A",
    // Foreground-safe accent for ink on light surfaces (AA ~4.8:1 on white).
    "accent-strong": "#8A6D00",
    // Deeper gold for the primary-button fill so a CTA reads as clickable.
    "accent-button": "#BE9A0B",
    "accent-button-hover": "#A5860A",

    // Text
    "text-primary": "#111111",
    "text-secondary": "#444444",
    "text-muted": "#5C5C5C",
    "text-on-accent": "#0D0D0D",

    // Borders
    border: "#D4D4D4",
    "border-light": "#BFBFBF",

    // Misc
    "logo-bg": "#1A1A1A",

    // Status
    "status-draft": "#767676",
    "status-submitted": "#2563EB",
    "status-approved-arch": "#16A34A",
    "status-approved-client": "#C9A30C",
    "status-changes": "#D97706",

    // Semantic
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    info: "#2563EB",

    // Danger
    danger: "#DC2626",
    "danger-hover": "#B91C1C",
    "danger-muted": "rgba(220, 38, 38, 0.1)",
    "danger-border": "rgba(220, 38, 38, 0.3)",
  },
};

export default lightTheme;
