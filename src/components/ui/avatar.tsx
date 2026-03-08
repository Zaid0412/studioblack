import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  src?: string;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
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
export function Avatar({ initials, size = "md", src, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={cn(
          "rounded-full object-cover",
          sizeStyles[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-accent text-text-on-accent font-semibold shrink-0",
        sizeStyles[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
