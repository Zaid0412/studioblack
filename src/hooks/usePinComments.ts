import { useState, useCallback, useEffect } from "react";
import { pinComments } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import type { DbPinComment } from "@/types";

interface UsePinCommentsParams {
  projectId: string;
  attachmentId: string;
}

export function usePinComments({ projectId, attachmentId }: UsePinCommentsParams) {
  const [pins, setPins] = useState<DbPinComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState(false);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pinComments.list(projectId, attachmentId);
      setPins(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, attachmentId]);

  useEffect(() => {
    fetchPins();
    setSelectedPinId(null);
    setPinMode(false);
  }, [fetchPins]);

  const addPin = useCallback(
    async (data: {
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      content: string;
      requestApproval?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
    }) => {
      try {
        const pin = await pinComments.create(projectId, attachmentId, {
          x_percent: data.xPercent ?? null,
          y_percent: data.yPercent ?? null,
          page: data.page ?? null,
          content: data.content,
          request_approval: data.requestApproval,
          assign_as_task: data.assignAsTask
            ? {
                assigned_to: data.assignAsTask.assignedTo,
                due_date: data.assignAsTask.dueDate,
              }
            : undefined,
        });
        setPins((prev) => [...prev, pin]);
      } catch {
        toast({
          title: "Error",
          description: "Failed to add comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId]
  );

  const resolvePin = useCallback(
    async (pinId: string, resolved: boolean) => {
      // Optimistic update
      setPins((prev) =>
        prev.map((p) => (p.id === pinId ? { ...p, resolved } : p))
      );
      try {
        await pinComments.resolve(projectId, attachmentId, pinId, resolved);
      } catch {
        // Rollback
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

  const deletePin = useCallback(
    async (pinId: string) => {
      const prev = pins;
      // Optimistic update
      setPins((p) => p.filter((pin) => pin.id !== pinId));
      if (selectedPinId === pinId) setSelectedPinId(null);
      try {
        await pinComments.remove(projectId, attachmentId, pinId);
      } catch {
        // Rollback
        setPins(prev);
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, pins, selectedPinId]
  );

  const unresolvedCount = pins.filter((p) => !p.resolved).length;

  return {
    pins,
    loading,
    selectedPinId,
    setSelectedPinId,
    pinMode,
    setPinMode,
    addPin,
    resolvePin,
    deletePin,
    unresolvedCount,
  };
}
