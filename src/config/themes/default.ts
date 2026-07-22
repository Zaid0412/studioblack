import type { Theme } from "./index";

/**
 * The default dark theme — StudioBlack's signature look.
 * Keep in sync with the :root block in src/app/globals.css.
 */
const defaultTheme: Theme = {
  name: "StudioBlack",
  colors: {
    // Backgrounds
    "bg-primary": "#0D0D0D",
    "bg-secondary": "#1A1A1A",
    "bg-elevated": "#242424",
    "bg-input": "#2A2A2A",

    // Accent
    accent: "#F5C518",
    "accent-hover": "#D4A90D",
    // On dark surfaces the bright accent is already readable as ink → == accent.
    "accent-strong": "#F5C518",
    // The dark accent is already a vivid CTA — reuse it for the button fill.
    "accent-button": "#F5C518",
    "accent-button-hover": "#D4A90D",

    // Text
    "text-primary": "#FFFFFF",
    "text-secondary": "#B0B0B0",
    "text-muted": "#808080",
    "text-on-accent": "#0D0D0D",

    // Borders
    border: "#333333",
    "border-light": "#444444",

    // Misc
    "logo-bg": "transparent",

    // Status
    "status-draft": "#666666",
    "status-submitted": "#3B82F6",
    "status-approved-arch": "#22C55E",
    "status-approved-client": "#F5C518",
    "status-changes": "#F59E0B",

    // Semantic
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // Danger
    danger: "#EF4444",
    "danger-hover": "#DC2626",
    "danger-muted": "rgba(239, 68, 68, 0.15)",
    "danger-border": "rgba(239, 68, 68, 0.4)",
  },
};

export default defaultTheme;
