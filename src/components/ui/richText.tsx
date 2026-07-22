import type { ReactNode } from "react";

/**
 * Rich-text tag renderers for next-intl `t.rich(...)`. Wrapping a value in
 * `<b>…</b>` inside a message highlights it — semibold, primary text colour —
 * so the meaningful parts of confirmation copy (names, counts) stand out from
 * the muted description text around them.
 *
 * Usage: `t.rich("someKey", { ...emphasisTags, name, count })` with the message
 * `Delete “<b>{name}</b>”?`.
 */
export const emphasisTags = {
  b: (chunks: ReactNode) => (
    <strong className="font-semibold text-text-primary">{chunks}</strong>
  ),
};
