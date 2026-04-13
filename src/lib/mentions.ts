import type { MentionMember } from "@/types";

/** Matches `@[Display Name](userId)` in raw text. */
export const MENTION_REGEX = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

/** Extract unique user IDs from content containing @mentions. */
export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex since the regex is global
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    ids.add(match[2]);
  }
  return Array.from(ids);
}

/** Build a mention string from user data. */
export function insertMention(userId: string, displayName: string): string {
  return `@[${displayName}](${userId})`;
}

/** Filter members by partial name query (case-insensitive). */
export function filterMembers(
  members: MentionMember[],
  query: string
): MentionMember[] {
  const lower = query.toLowerCase();
  return members.filter((m) => m.name.toLowerCase().includes(lower));
}
