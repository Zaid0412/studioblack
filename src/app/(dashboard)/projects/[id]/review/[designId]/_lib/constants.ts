/** EmbedPDF dark theme matching StudioBlack design tokens. */
export const EMBEDPDF_THEME = {
  preference: "dark" as const,
  dark: {
    accent: {
      primary: "#F5C518",
      primaryHover: "#D4A912",
      primaryForeground: "#0D0D0D",
    },
    background: {
      app: "#1A1A1A",
      surface: "#242424",
      surfaceAlt: "#1A1A1A",
      elevated: "#2A2A2A",
      input: "#2A2A2A",
    },
    foreground: {
      primary: "#FFFFFF",
      secondary: "#A0A0A0",
      muted: "#666666",
    },
    border: {
      default: "#333333",
    },
  },
};

/** Hide features from EmbedPDF that we handle in our own toolbar. */
export const DISABLED_CATEGORIES = [
  "document-menu",
  "document-print",
  "document-open",
  "document-close",
  "document-export",
  "document-protect",
];
