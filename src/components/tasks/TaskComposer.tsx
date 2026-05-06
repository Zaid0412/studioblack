"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { taskComments } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { TaskMarkdownEditor } from "./TaskMarkdownEditor";

interface TaskComposerProps {
  taskId: string;
  /** Called after a successful POST so the parent can revalidate the list. */
  onSubmitted?: () => void;
  /**
   * When true, render the avatar bullet so this composer hangs off a parent
   * timeline rail (e.g. on `/tasks/[id]`). Defaults to false (side-panel use).
   */
  inTimeline?: boolean;
}

/**
 * Composer for the side panel and `/tasks/[id]`. Uses the shared markdown
 * editor so it picks up the same toolbar, paste-to-upload, and Write/Preview
 * tabs as the create page. When `inTimeline`, renders an avatar bullet on
 * the left so it visually continues the timeline rail.
 */
export function TaskComposer({
  taskId,
  onSubmitted,
  inTimeline,
}: TaskComposerProps) {
  const { data: session } = authClient.useSession();
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

  const editor = (
    <div className="space-y-2">
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

  if (inTimeline) {
    return (
      <article className="relative pl-9">
        {session?.user && (
          <Avatar
            initials={deriveInitials(session.user.name || session.user.email)}
            color={avatarColor(session.user.id)}
            size="sm"
            className="absolute left-0 top-2 ring-2 ring-bg-primary"
          />
        )}
        {editor}
      </article>
    );
  }

  return (
    <div className="border-t border-border-default px-4 py-3 bg-bg-primary">
      {editor}
    </div>
  );
}
