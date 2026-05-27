import { createElement } from "react";
import { getSectionIcon } from "./icons";

/**
 * Render a lucide icon by its PascalCase name. Wraps the `getSectionIcon`
 * lookup so callers don't have to PascalCase a local variable in JSX (which
 * trips the `react-hooks/static-components` rule when done at the top of
 * a render function).
 *
 * Uses `createElement` instead of capitalising the resolved component into
 * a local — the lint rule fires on either, but `createElement` keeps the
 * lookup an expression rather than a declaration.
 */
export function SectionIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  return createElement(getSectionIcon(icon), { className });
}
