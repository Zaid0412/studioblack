"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  /** Currently selected date. */
  value?: Date;
  /** Callback fired when the user picks a date. */
  onChange?: (date: Date | undefined) => void;
  /** Optional label rendered above the trigger button. */
  label?: string;
  /** Placeholder shown when no date is selected. */
  placeholder?: string;
  /** Date string used as the initial value (ISO format, e.g. "2025-06-15"). */
  defaultValue?: string;
  /** Additional classes applied to the outer wrapper. */
  className?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Render a red `*` after the label, matching `Input`. */
  required?: boolean;
}

/**
 * Date picker that pairs a styled trigger button with a calendar popover.
 *
 * Supports both controlled (`value` / `onChange`) and uncontrolled
 * (`defaultValue`) usage. Matches the app's Input component styling so
 * it sits seamlessly inside forms.
 */
function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  defaultValue,
  className,
  disabled,
  required,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(
    () => {
      if (value) return value;
      if (defaultValue) return new Date(defaultValue + "T00:00:00");
      return undefined;
    }
  );

  const selected = value ?? internalDate;

  const handleSelect = (date: Date | undefined) => {
    setInternalDate(date);
    onChange?.(date);
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-[13px] font-medium text-text-secondary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm transition-colors text-left cursor-pointer",
              "hover:border-border-light focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30",
              selected ? "text-text-primary" : "text-text-muted",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <CalendarDays className="h-4 w-4 text-warning shrink-0" />
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

DatePicker.displayName = "DatePicker";

export { DatePicker };
export type { DatePickerProps };
