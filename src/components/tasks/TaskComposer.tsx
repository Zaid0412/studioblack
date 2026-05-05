"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { taskComments } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { TaskMarkdownEditor } from "./TaskMarkdownEditor";

interface TaskComposerProps {
  taskId: string;
  /** Called after a successful POST so the parent can revalidate the list. */
  onSubmitted?: () => void;
}

/**
 * Composer pinned to the bottom of the side panel and embedded inline on
 * `/tasks/[id]`. Uses the shared markdown editor so the comment body picks up
 * the same toolbar, paste-to-upload, and Write/Preview tabs as the create
 * page.
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

  return (
    <div className="border-t border-border-default px-4 py-3 bg-bg-primary space-y-2">
      <TaskMarkdownEditor
        value={body}
        onChange={setBody}
        placeholder="Leave a comment, paste an image, or drop a file…"
        minHeight={120}
      />
      <div className="flex items-center justify-end gap-2">
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
