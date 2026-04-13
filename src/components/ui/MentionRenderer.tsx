"use client";

import { MENTION_REGEX } from "@/lib/mentions";

interface MentionRendererProps {
  content: string;
  className?: string;
}

export function MentionRenderer({ content, className }: MentionRendererProps) {
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="text-mention-text bg-mention-bg rounded-[4px] px-[3px] py-[1px] font-semibold"
      >
        @{match[1]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
