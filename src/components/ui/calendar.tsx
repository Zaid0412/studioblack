"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Themed calendar built on `react-day-picker`.
 *
 * Styled to match the dark design system — accent-coloured selected day,
 * subtle hover states, and Lucide chevron navigation.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex items-center justify-center h-7 px-9",
        caption_label: "text-sm font-medium text-text-primary",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between pointer-events-none",
        button_previous:
          "inline-flex items-center justify-center h-7 w-7 rounded-md border-0 bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer pointer-events-auto",
        button_next:
          "inline-flex items-center justify-center h-7 w-7 rounded-md border-0 bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer pointer-events-auto",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-text-muted text-xs font-medium w-8 h-8 flex items-center justify-center",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative",
        day_button:
          "inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-normal text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer border-0 bg-transparent",
        selected:
          "[&>button]:bg-accent [&>button]:text-text-on-accent [&>button]:font-semibold [&>button]:hover:bg-accent-hover",
        today:
          "[&>button]:bg-accent/20 [&>button]:text-accent-strong [&>button]:font-bold [&>button]:border [&>button]:border-accent-strong/60",
        outside: "[&>button]:text-text-muted/40",
        disabled: "[&>button]:text-text-muted/30 [&>button]:cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };
