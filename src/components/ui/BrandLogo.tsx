import Image from "next/image";
import { branding } from "@/config/branding";

/**
 * Renders the application logo. The logo image includes the app name,
 * so no separate text label is needed alongside this component.
 *
 * @param props.size - `"sm"` for nav bars, `"md"` for auth/hero panels.
 */
export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? 32 : 40;

  return branding.logoUrl ? (
    <Image
      src={branding.logoUrl}
      alt={branding.appName}
      width={h * 3}
      height={h}
      className={`${size === "sm" ? "h-8" : "h-10"} w-auto object-contain`}
    />
  ) : (
    <div
      className={`flex items-center justify-center ${size === "sm" ? "h-8 px-2 rounded-md" : "h-10 px-3 rounded-lg"} bg-accent`}
    >
      <span
        className={`${size === "sm" ? "text-sm" : "text-base"} font-bold text-text-on-accent`}
      >
        {branding.appName}
      </span>
    </div>
  );
}
