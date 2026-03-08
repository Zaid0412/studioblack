"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

/**
 * Text input pre-styled with a search (magnifying-glass) icon on the left.
 *
 * Forwards a ref to the underlying `<input>` element.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
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
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
