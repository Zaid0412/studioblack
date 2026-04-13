"use client";

import { forwardRef, useCallback, useMemo, type KeyboardEvent } from "react";
import { MentionsInput, Mention } from "react-mentions-ts";
import type { MentionsInputChangeEvent } from "react-mentions-ts";
import type { MentionMember } from "@/types";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  members: MentionMember[];
  placeholder?: string;
  rows?: number;
  /** Applied to the visible control (border/bg/padding box). */
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/** Map members to the format react-mentions expects. */
function toMentionData(members: MentionMember[]) {
  return members.map((m) => ({ id: m.user_id, display: m.name }));
}

/** Prepend @ so mentions are visually distinct in the textarea. */
const displayWithAt = (_id: string | number, display?: string | null) =>
  `@${display ?? ""}`;

const DEFAULT_CONTROL =
  "relative rounded-lg border border-border-default bg-bg-input text-sm";
const INPUT_CLASS =
  "relative block w-full m-0 box-border border-0 bg-transparent text-transparent caret-text-primary transition placeholder:text-text-secondary [font-family:inherit] [font-size:inherit] [letter-spacing:inherit] h-full overflow-hidden resize-none whitespace-pre-wrap break-words p-3 outline-none";
const HIGHLIGHTER_CLASS =
  "absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words p-3 text-text-primary";

export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  MentionTextareaProps
>(function MentionTextarea(
  { value, onChange, members, placeholder, rows = 4, className, onKeyDown },
  ref
) {
  const handleMentionsChange = useCallback(
    (change: MentionsInputChangeEvent) => {
      onChange(change.value);
    },
    [onChange]
  );

  const data = useMemo(() => toMentionData(members), [members]);

  const classNames = useMemo(
    () => ({
      control: className ?? DEFAULT_CONTROL,
      input: INPUT_CLASS,
      highlighter: HIGHLIGHTER_CLASS,
      highlighterSubstring: "text-text-primary",
      suggestions:
        "z-[100] w-full min-w-[12rem] mt-1 border border-border-default bg-bg-secondary rounded-lg shadow-lg animate-[mention-dropdown-in_150ms_ease-out]",
      suggestionsList: "m-0 max-h-48 list-none overflow-y-auto p-1",
      suggestionItem:
        "cursor-pointer select-none text-sm text-text-secondary transition-colors hover:bg-bg-elevated px-3 py-1.5 rounded-md",
      suggestionItemFocused:
        "cursor-pointer select-none text-sm text-accent bg-bg-elevated px-3 py-1.5 rounded-md",
    }),
    [className]
  );

  return (
    <MentionsInput
      inputRef={ref as React.RefObject<HTMLTextAreaElement>}
      value={value}
      onMentionsChange={handleMentionsChange}
      onKeyDown={
        onKeyDown as unknown as (
          e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => void
      }
      placeholder={placeholder}
      rows={rows}
      classNames={classNames}
      a11ySuggestionsListLabel="Suggested members"
    >
      <Mention
        trigger="@"
        data={data}
        appendSpaceOnAdd
        displayTransform={displayWithAt}
        className="mention-hl bg-mention-bg rounded-[4px]"
      />
    </MentionsInput>
  );
});
