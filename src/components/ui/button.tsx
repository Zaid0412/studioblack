import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Available visual styles for Button. */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
/** Available size presets for Button. */
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-on-accent hover:bg-accent-hover font-semibold",
  secondary:
    "bg-transparent text-text-primary border border-border-light hover:bg-bg-elevated font-medium",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated font-medium",
  danger:
    "bg-error/10 text-error border border-error/20 hover:bg-error/20 font-medium",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-6 py-2.5 gap-2",
  lg: "text-sm px-8 py-3 gap-2",
};

/**
 * Themed button primitive.
 *
 * Supports four variants (`primary`, `secondary`, `ghost`, `danger`) and
 * three sizes (`sm`, `md`, `lg`). Forwards a ref to the underlying `<button>`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-[color,background-color,border-color,transform] duration-150 cursor-pointer active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
