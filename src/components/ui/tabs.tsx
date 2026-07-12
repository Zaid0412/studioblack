"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { SlidingIndicator } from "@/components/ui/SlidingIndicator";

/**
 * Radix doesn't expose its tabs context, and `TabsList` needs the active value
 * to position the sliding pill. Since `Tabs` is ours, it republishes the value
 * here — otherwise the list would have to observe the DOM for `data-state`
 * flips just to learn something its own root already knows.
 */
const TabsValueContext = React.createContext<string | undefined>(undefined);

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

/** Radix `Tabs` root, wrapped to publish the active value to `TabsList`. */
const Tabs = ({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: TabsProps) => {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const active = value ?? uncontrolled;

  const handleValueChange = React.useCallback(
    (next: string) => {
      setUncontrolled(next);
      onValueChange?.(next);
    },
    [onValueChange]
  );

  return (
    <TabsValueContext.Provider value={active}>
      <TabsPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsValueContext.Provider>
  );
};

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const activeValue = React.useContext(TabsValueContext);
  const listRef = React.useRef<HTMLDivElement>(null);
  const indicator = useSlidingIndicator(listRef, activeValue);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );
  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-bg-elevated p-1",
        className
      )}
      {...props}
    >
      {/* Tracks all four coordinates so the pill stays correct even in a list
          that wraps to multiple rows. */}
      <SlidingIndicator
        className="rounded-md bg-bg-secondary shadow-sm"
        style={indicator}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const active = React.useContext(TabsValueContext) === props.value;
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-active={active}
      className={cn(
        "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium text-text-muted ring-offset-bg-primary transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:text-text-primary",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
