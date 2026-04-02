import Image from "next/image";
import { branding } from "@/config/branding";

/**
 * Renders the application logo — either an `<img>` when a `logoUrl` is
 * configured in branding, or a coloured square with the first letter of the
 * app name as a fallback.
 *
 * @param props - Component props.
 * @param props.size - `"sm"` (32×32) for compact contexts, `"md"` (40×40) for the
 *   auth hero panel.
 */
export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const textSize = size === "sm" ? "text-base" : "text-lg";
  const rounded = size === "sm" ? "rounded-md" : "rounded-lg";

  // When logo contains app name, render larger
  const dims = branding.showLogoText
    ? size === "sm" ? "h-8 w-8" : "h-10 w-10"
    : size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const imgSize = branding.showLogoText
    ? (size === "sm" ? 32 : 40)
    : (size === "sm" ? 40 : 56);

  return branding.logoUrl ? (
    <Image
      src={branding.logoUrl}
      alt={branding.appName}
      width={imgSize}
      height={imgSize}
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
