"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { taskComments } from "@/lib/api";
import { ApiError } from "@/lib/api";

interface TaskComposerProps {
  taskId: string;
  /** Called after a successful POST so the parent can revalidate the list. */
  onSubmitted?: () => void;
}

/**
 * Sticky composer pinned to the bottom of the side panel. Plain textarea for
 * Phase 1 — markdown rendering, inline image paste, drag-drop attachments,
 * and the toolbar shown in the mockup land in a follow-up commit alongside
 * the `/tasks/[id]` and `/tasks/new` pages so the same composer can drive
 * all three surfaces.
 */
export function TaskComposer({ taskId, onSubmitted }: TaskComposerProps) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await taskComments.create(taskId, { body: trimmed });
      setBody("");
      onSubmitted?.();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to post comment";
      toast({ title: "Couldn't post comment", description: message });
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+Enter submits — matches GH/Linear convention.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border-default px-4 py-3 bg-bg-primary">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Leave a comment, paste an image, or @-mention…"
        rows={3}
        className="w-full text-sm bg-bg-input border border-border-default rounded-lg px-3 py-2 placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[11px] text-text-muted">
          Markdown support coming soon
        </span>
        <Button
          size="sm"
          onClick={submit}
          disabled={!body.trim() || posting}
          aria-busy={posting}
        >
          {posting ? "Posting…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
