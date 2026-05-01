import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface LabelValueItem {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

interface Props {
  items: LabelValueItem[];
  className?: string;
}

/** Two-column description list (label | value) used in mobile card layouts. */
export function LabelValueList({ items, className }: Props) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-sm",
        className
      )}
    >
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt className="text-text-muted">{item.label}</dt>
          <dd className={cn("text-text-secondary", item.valueClassName)}>
            {item.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
