import { branding } from "@/config/branding";

/**
 * Renders the application logo — either an `<img>` when a `logoUrl` is
 * configured in branding, or a coloured square with the first letter of the
 * app name as a fallback.
 *
 * @param size - `"sm"` (32×32) for compact contexts, `"md"` (40×40) for the
 *   auth hero panel.
 */
export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "sm" ? "text-base" : "text-lg";
  const rounded = size === "sm" ? "rounded-md" : "rounded-lg";

  return branding.logoUrl ? (
    <img
      src={branding.logoUrl}
      alt={branding.appName}
      className={`${dims} ${rounded} object-contain`}
    />
  ) : (
    <div
      className={`flex items-center justify-center ${dims} ${rounded} bg-accent`}
    >
      <span className={`${textSize} font-bold text-text-on-accent`}>
        {branding.appName.charAt(0)}
      </span>
    </div>
  );
}
