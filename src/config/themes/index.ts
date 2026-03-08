/**
 * Shape of a StudioBlack theme.
 *
 * All colour tokens and font settings are stored here and applied to
 * CSS custom properties at runtime via the ThemeProvider.
 */
export interface Theme {
  /** Human-readable theme name (e.g. "StudioBlack"). */
  name: string;
  /** Map of CSS variable names (without `--`) to hex/rgb values. */
  colors: Record<string, string>;
  /** Optional font-family overrides. */
  font?: {
    /** Primary sans-serif stack used for body and UI text. */
    sans: string;
  };
}

export { default as defaultTheme } from "./default";
