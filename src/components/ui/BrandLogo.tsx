import Image from "next/image";
import { branding } from "@/config/branding";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Renders the application logo — either an `<img>` when a `logoUrl` is
 * configured in branding, or a coloured square with the first letter of the
 * app name as a fallback.
 *
 * @param props - Component props.
 * @param props.size - `"sm"` (32×32) for compact contexts, `"md"` (40×40) for the
 *   auth hero panel.
 */
const sizeMap = {
  sm: {
    withText: "h-8 w-8",
    noText: "h-10 w-10",
    withTextPx: 32,
    noTextPx: 40,
  },
  md: {
    withText: "h-10 w-10",
    noText: "h-14 w-14",
    withTextPx: 40,
    noTextPx: 56,
  },
  lg: {
    withText: "h-12 w-12",
    noText: "h-36 w-36",
    withTextPx: 48,
    noTextPx: 144,
  },
} as const;

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { mode } = useTheme();
  const textSize = size === "sm" ? "text-base" : "text-lg";
  const rounded = size === "sm" ? "rounded-md" : "rounded-lg";
  const s = sizeMap[size];
  const dims = branding.showLogoText ? s.withText : s.noText;
  const imgSize = branding.showLogoText ? s.withTextPx : s.noTextPx;
  const logoSrc =
    mode === "dark"
      ? branding.logoUrl
      : (branding.logoUrlDark ?? branding.logoUrl);

  return logoSrc ? (
    <Image
      src={logoSrc}
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
