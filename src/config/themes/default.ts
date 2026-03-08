import type { Theme } from "./index";

/** The default dark theme — StudioBlack's signature look. */
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

    // Text
    "text-primary": "#FFFFFF",
    "text-secondary": "#A0A0A0",
    "text-muted": "#666666",
    "text-on-accent": "#0D0D0D",

    // Borders
    border: "#333333",
    "border-light": "#444444",

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
  },
  font: {
    sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
};

export default defaultTheme;
