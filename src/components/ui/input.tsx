import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Themed text input with optional label and error message.
 *
 * Generates an `id` from the label when none is provided so the `<label>`
 * and `<input>` are always linked for accessibility.
 *
 * When `type="password"`, renders a toggle button to show/hide the value.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
              error && "border-error focus:border-error focus:ring-error/30",
              isPassword && "pr-12",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" }}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
