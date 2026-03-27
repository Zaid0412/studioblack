import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  src?: string;
  /** Override background color (e.g. from avatarColor). Falls back to accent. */
  color?: string;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
  xl: "w-16 h-16 text-xl",
};

/**
 * Circular avatar displaying either an image or initials.
 *
 * When `src` is provided an `<img>` is rendered; otherwise a coloured
 * circle with the user's initials is shown using the accent colour.
 */
export function Avatar({
  initials,
  size = "md",
  src,
  color,
  className,
}: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={initials}
        className={cn("rounded-full object-cover", sizeStyles[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold shrink-0",
        !color && "bg-accent text-text-on-accent",
        color && "text-white",
        sizeStyles[size],
        className
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {initials}
    </div>
  );
}
