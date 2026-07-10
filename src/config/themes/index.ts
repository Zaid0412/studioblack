/**
 * Shape of a StudioBlack theme.
 *
 * Colour tokens are stored here and applied to CSS custom properties at
 * runtime via the ThemeProvider. Fonts are theme-independent and live in
 * globals.css, not here.
 */
export interface Theme {
  /** Human-readable theme name (e.g. "StudioBlack"). */
  name: string;
  /**
   * Map of CSS variable names (without `--`) to hex/rgb values.
   * All themes must define the same set of keys so switching never
   * leaves stale CSS custom properties on :root.
   */
  colors: Record<string, string>;
}

export { default as defaultTheme } from "./default";
export { default as lightTheme } from "./light";
