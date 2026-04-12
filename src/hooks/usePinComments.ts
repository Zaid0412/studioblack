import { useState, useCallback, useEffect, useMemo } from "react";
import { pinComments } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import type { DbPinComment } from "@/types";

interface UsePinCommentsParams {
  projectId: string;
  attachmentId: string;
  /** Current user name — used for optimistic updates. */
  userName?: string;
}

/** Manages pin comment state with optimistic updates for a given attachment. */
export function usePinComments({
  projectId,
  attachmentId,
  userName = "",
}: UsePinCommentsParams) {
  // Reset key forces state to reinitialize when params change
  const fetchKey = `${projectId}:${attachmentId}`;
  const [prevKey, setPrevKey] = useState(fetchKey);
  const [pins, setPins] = useState<DbPinComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState(false);
  /** Replies keyed by parent pin ID — lazily loaded. */
  const [repliesMap, setRepliesMap] = useState<Map<string, DbPinComment[]>>(
    new Map()
  );

  // Reset state when params change (React 19 idiomatic pattern)
  if (prevKey !== fetchKey) {
    setPrevKey(fetchKey);
    setPins([]);
    setLoading(true);
    setSelectedPinId(null);
    setPinMode(false);
    setRepliesMap(new Map());
  }

  useEffect(() => {
    let ignore = false;

    pinComments
      .list(projectId, attachmentId)
      .then((data) => {
        if (!ignore) setPins(data);
      })
      .catch(() => {
        if (!ignore)
          toast({
            title: "Error",
            description: "Failed to load comments",
            variant: "error",
          });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [projectId, attachmentId]);

  // ── Add pin (optimistic) ──────────────────────────────────────────────

  const addPin = useCallback(
    async (data: {
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      content: string;
      requestChanges?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
    }) => {
      // Optimistic: insert a temp pin immediately
      const tempId = `temp-${Date.now()}`;
      const tempPin: DbPinComment = {
        id: tempId,
        attachment_id: attachmentId,
        user_id: "",
        user_name: userName,
        x_percent: data.xPercent ?? null,
        y_percent: data.yPercent ?? null,
        page: data.page ?? null,
        content: data.content,
        resolved: false,
        task_id: null,
        request_approval: false,
        request_changes: data.requestChanges ?? false,
        parent_id: null,
        updated_at: null,
        reply_count: 0,
        created_at: new Date().toISOString(),
      };
      setPins((prev) => [...prev, tempPin]);

      try {
        const pin = await pinComments.create(projectId, attachmentId, {
          x_percent: data.xPercent ?? null,
          y_percent: data.yPercent ?? null,
          page: data.page ?? null,
          content: data.content,
          request_changes: data.requestChanges,
          assign_as_task: data.assignAsTask
            ? {
                assigned_to: data.assignAsTask.assignedTo,
                due_date: data.assignAsTask.dueDate,
              }
            : undefined,
        });
        // Replace temp with real
        setPins((prev) => prev.map((p) => (p.id === tempId ? pin : p)));
      } catch {
        // Rollback
        setPins((prev) => prev.filter((p) => p.id !== tempId));
        toast({
          title: "Error",
          description: "Failed to add comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, userName]
  );

  // ── Resolve ───────────────────────────────────────────────────────────

  const resolvePin = useCallback(
    async (pinId: string, resolved: boolean) => {
      setPins((prev) =>
        prev.map((p) => (p.id === pinId ? { ...p, resolved } : p))
      );
      try {
        await pinComments.resolve(projectId, attachmentId, pinId, resolved);
      } catch {
        setPins((prev) =>
          prev.map((p) => (p.id === pinId ? { ...p, resolved: !resolved } : p))
        );
        toast({
          title: "Error",
          description: "Failed to update comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId]
  );

  // ── Edit content ──────────────────────────────────────────────────────

  const refetchPins = useCallback(async () => {
    try {
      const data = await pinComments.list(projectId, attachmentId);
      setPins(data);
    } catch {
      /* refetch is best-effort */
    }
  }, [projectId, attachmentId]);

  const editPin = useCallback(
    async (pinId: string, content: string) => {
      setPins((ps) =>
        ps.map((p) =>
          p.id === pinId
            ? { ...p, content, updated_at: new Date().toISOString() }
            : p
        )
      );
      try {
        await pinComments.editContent(projectId, attachmentId, pinId, content);
      } catch {
        await refetchPins();
        toast({
          title: "Error",
          description: "Failed to edit comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, refetchPins]
  );

  // ── Delete ────────────────────────────────────────────────────────────

  const deletePin = useCallback(
    async (pinId: string) => {
      setPins((ps) => ps.filter((pin) => pin.id !== pinId));
      setSelectedPinId((prev) => (prev === pinId ? null : prev));
      try {
        await pinComments.remove(projectId, attachmentId, pinId);
      } catch {
        await refetchPins();
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, refetchPins]
  );

  // ── Reposition ────────────────────────────────────────────────────────

  const repositionPin = useCallback(
    async (pinId: string, xPercent: number, yPercent: number, page: number) => {
      setPins((ps) =>
        ps.map((p) =>
          p.id === pinId
            ? { ...p, x_percent: xPercent, y_percent: yPercent, page }
            : p
        )
      );
      try {
        await pinComments.reposition(projectId, attachmentId, pinId, {
          x_percent: xPercent,
          y_percent: yPercent,
          page,
        });
      } catch {
        await refetchPins();
        toast({
          title: "Error",
          description: "Failed to reposition pin",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, refetchPins]
  );

  // ── Replies ───────────────────────────────────────────────────────────

  const fetchReplies = useCallback(
    async (parentId: string) => {
      try {
        const replies = await pinComments.listReplies(
          projectId,
          attachmentId,
          parentId
        );
        setRepliesMap((prev) => {
          const next = new Map(prev);
          next.set(parentId, replies);
          return next;
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to load replies",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId]
  );

  const addReply = useCallback(
    async (parentId: string, content: string) => {
      try {
        const reply = await pinComments.create(projectId, attachmentId, {
          content,
          parent_id: parentId,
        });
        // Update replies map
        setRepliesMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(parentId) ?? [];
          next.set(parentId, [...existing, reply]);
          return next;
        });
        // Increment reply_count on parent
        setPins((ps) =>
          ps.map((p) =>
            p.id === parentId
              ? { ...p, reply_count: (p.reply_count ?? 0) + 1 }
              : p
          )
        );
      } catch {
        toast({
          title: "Error",
          description: "Failed to add reply",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId]
  );

  const unresolvedCount = useMemo(
    () => pins.filter((p) => !p.resolved).length,
    [pins]
  );

  return {
    pins,
    loading,
    selectedPinId,
    setSelectedPinId,
    pinMode,
    setPinMode,
    addPin,
    resolvePin,
    editPin,
    deletePin,
    repositionPin,
    repliesMap,
    fetchReplies,
    addReply,
    unresolvedCount,
  };
}
