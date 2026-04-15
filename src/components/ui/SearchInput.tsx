"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  forwardRef,
  useState,
  useEffect,
  useRef,
  useCallback,
  type InputHTMLAttributes,
  type ChangeEvent,
} from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  /** When set, onChange fires after the user stops typing for this many ms. */
  debounceMs?: number;
}

/**
 * Text input pre-styled with a search (magnifying-glass) icon on the left.
 *
 * Forwards a ref to the underlying `<input>` element.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, debounceMs, onChange, value, ...props }, ref) => {
    const [localValue, setLocalValue] = useState<string | number | readonly string[]>(value ?? "");
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Sync external value changes into local state
    useEffect(() => {
      if (value !== undefined) setLocalValue(value);
    }, [value]);

    // Cleanup timer on unmount
    useEffect(() => () => { clearTimeout(timerRef.current); }, []);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!debounceMs) {
          onChange?.(e);
          return;
        }
        const val = e.target.value;
        setLocalValue(val);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          // Build a lightweight event-like object so e.target.value is reliable
          // after the delay (the original DOM ref may have changed).
          onChange?.({ target: { value: val } } as ChangeEvent<HTMLInputElement>);
        }, debounceMs);
      },
      [debounceMs, onChange]
    );

    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          ref={ref}
          className={cn(
            "w-full rounded-lg border border-border-default bg-bg-input pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
            className
          )}
          value={debounceMs ? localValue : value}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
