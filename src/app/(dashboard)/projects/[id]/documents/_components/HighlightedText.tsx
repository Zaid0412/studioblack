import { useMemo } from "react";

/**
 * Render `text` with every (case-insensitive) occurrence of `query`
 * highlighted via a `<mark>` element. Empty/whitespace-only queries
 * return the original text unchanged so callers don't need to gate
 * the component themselves.
 *
 * Used by document rows so search-filtered results visually pinpoint
 * which characters of the filename / description matched.
 */
export function HighlightedText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const segments = useMemo(() => splitOnQuery(text, query), [text, query]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="bg-accent/30 text-text-primary rounded-[2px]"
          >
            {seg.value}
          </mark>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  );
}

interface Segment {
  value: string;
  match: boolean;
}

function splitOnQuery(text: string, query: string): Segment[] {
  const trimmed = query.trim();
  if (!trimmed) return [{ value: text, match: false }];
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const out: Segment[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lowerText.indexOf(lowerQuery, i);
    if (idx === -1) {
      out.push({ value: text.slice(i), match: false });
      break;
    }
    if (idx > i) out.push({ value: text.slice(i, idx), match: false });
    out.push({ value: text.slice(idx, idx + lowerQuery.length), match: true });
    i = idx + lowerQuery.length;
  }
  return out;
}
