/**
 * Global branding constants.
 *
 * Every place the app name, tagline, or logo appears reads from this object
 * so a single edit propagates everywhere (sidebar, login hero, client portal, etc.).
 */
export const branding = {
  appName: "StudioBlack",
  tagline: "Design Reviews, Simplified",
  subtitle: "Streamlined architectural design review & approval",
  logoUrl: "https://studio-black.co.in/wp-content/uploads/2024/05/SB_logo.png",
  supportEmail: "support@studioblack.com",
} as const;

/** TypeScript helper — inferred shape of the branding config. */
export type Branding = typeof branding;
