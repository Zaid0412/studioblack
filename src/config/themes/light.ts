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

    // Text
    "text-primary": "#111111",
    "text-secondary": "#555555",
    "text-muted": "#767676",
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
  font: {
    sans: '"Satoshi", ui-sans-serif, system-ui, sans-serif',
    heading:
      '"Cabinet Grotesk", "Satoshi", ui-sans-serif, system-ui, sans-serif',
  },
};

export default lightTheme;
