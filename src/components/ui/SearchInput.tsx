"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  /** When set, onDebouncedChange fires after the user stops typing for this many ms. */
  debounceMs?: number;
  /** Called with the debounced string value. Use instead of onChange when debounceMs is set. */
  onDebouncedChange?: (value: string) => void;
}

/**
 * Text input pre-styled with a search (magnifying-glass) icon on the left.
 *
 * Forwards a ref to the underlying `<input>` element.
 *
 * When `debounceMs` is set, the component manages its own display value
 * internally and fires `onDebouncedChange` after the user stops typing.
 * The parent's `value` prop is used as the initial value only.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      debounceMs,
      onDebouncedChange,
      onChange,
      value,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState(value ?? "");
    const fireDebounced = useDebouncedCallback(
      (val: string) => onDebouncedChange?.(val),
      debounceMs ?? 0
    );

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (!debounceMs) {
          onChange?.(e);
          return;
        }
        const val = e.target.value;
        setLocalValue(val);
        fireDebounced(val);
      },
      [debounceMs, onChange, fireDebounced]
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
