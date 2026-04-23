import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
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
 * - `type="password"`: renders a toggle button to show/hide the value.
 * - `type="number"`: hides the browser's native spinners and renders a
 *   themed ▲/▼ pair on the right edge. Clicking them dispatches a native
 *   `input` event so controlled-component callers' `onChange` fire.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const isNumber = type === "number";

    const internalRef = useRef<HTMLInputElement | null>(null);
    const setRefs = useCallback(
      (el: HTMLInputElement | null) => {
        internalRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      [ref]
    );

    const adjustBy = (direction: 1 | -1) => {
      const el = internalRef.current;
      if (!el || el.disabled || el.readOnly) return;

      const step = parseFloat(String(props.step ?? 1)) || 1;
      const min =
        props.min !== undefined ? parseFloat(String(props.min)) : -Infinity;
      const max =
        props.max !== undefined ? parseFloat(String(props.max)) : Infinity;

      const current = parseFloat(el.value);
      const base = Number.isFinite(current)
        ? current
        : Number.isFinite(min)
          ? min
          : 0;

      let next = base + direction * step;
      if (next < min) next = min;
      if (next > max) next = max;

      // Trim floating-point artefacts (0.1 + 0.2 → 0.30000000000000004).
      const decimals = (String(step).split(".")[1] ?? "").length;
      if (decimals > 0) next = Number(next.toFixed(decimals));

      // Bypass React's value descriptor so controlled inputs re-render.
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      descriptor?.set?.call(el, String(next));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-text-secondary"
          >
            {label}
            {props.required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={setRefs}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
              error && "border-error focus:border-error focus:ring-error/30",
              isPassword && "pr-12",
              isNumber &&
                "pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
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
          {isNumber && !props.disabled && !props.readOnly && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  adjustBy(1);
                }}
                aria-label="Increment"
                className="flex items-center justify-center h-4 w-5 rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated cursor-pointer"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  adjustBy(-1);
                }}
                aria-label="Decrement"
                className="flex items-center justify-center h-4 w-5 rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated cursor-pointer"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
