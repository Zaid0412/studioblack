import { useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/useToast";
import { tasks as tasksApi, upload } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import type { Task, TaskAttachment } from "@/types";
export type { ChecklistItem, TaskAttachment } from "@/types";
import type { ChecklistItem } from "@/types";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";

/** @deprecated Use {@link TaskAttachment} from `@/types` instead. */
export type Attachment = TaskAttachment;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Manage checklist items and attachments for a task detail modal. */
export function useTaskDetail(
  task: Task | null,
  open: boolean,
  onChecklistChange?: () => void
) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Data fetching (SWR) ----

  const taskId = task?.id ?? null;
  const checklistKey = open && taskId ? `task-checklist-${taskId}` : null;
  const attachmentsKey = open && taskId ? `task-attachments-${taskId}` : null;

  const {
    data: checklistItems = [],
    isLoading: loadingChecklist,
    mutate: mutateChecklist,
  } = useSWR<ChecklistItem[]>(checklistKey, () =>
    tasksApi.getChecklist(taskId!)
  );

  const {
    data: attachments = [],
    isLoading: loadingAttachments,
    mutate: mutateAttachments,
  } = useSWR<Attachment[]>(attachmentsKey, () =>
    tasksApi.getAttachments(taskId!)
  );

  const setChecklistItems = useCallback(
    (
      updater: ChecklistItem[] | ((prev: ChecklistItem[]) => ChecklistItem[])
    ) => {
      mutateChecklist(
        (prev) => {
          const current = prev ?? [];
          return typeof updater === "function" ? updater(current) : updater;
        },
        { revalidate: false }
      );
    },
    [mutateChecklist]
  );

  const setAttachments = useCallback(
    (updater: Attachment[] | ((prev: Attachment[]) => Attachment[])) => {
      mutateAttachments(
        (prev) => {
          const current = prev ?? [];
          return typeof updater === "function" ? updater(current) : updater;
        },
        { revalidate: false }
      );
    },
    [mutateAttachments]
  );

  // ---- Checklist handlers ----

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !task) return;

      const oldIndex = checklistItems.findIndex((i) => i.id === active.id);
      const newIndex = checklistItems.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(checklistItems, oldIndex, newIndex);
      setChecklistItems(reordered);

      try {
        await tasksApi.reorderChecklist(
          task.id,
          reordered.map((i) => i.id)
        );
      } catch {
        // Revalidate from server to restore correct order
        mutateChecklist();
      }
    },
    [checklistItems, task, mutateChecklist, setChecklistItems]
  );

  const addItem = useCallback(async () => {
    if (!task || !newItemTitle.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const item = await tasksApi.addChecklistItem(
        task.id,
        newItemTitle.trim()
      );
      setChecklistItems((prev) => [...prev, item]);
      setNewItemTitle("");
      onChecklistChange?.();
    } catch {
      toast({
        title: "Error",
        description: "Failed to add checklist item",
        variant: "error",
      });
    } finally {
      setAddingItem(false);
    }
  }, [task, newItemTitle, addingItem, onChecklistChange, setChecklistItems]);

  const toggleItem = useCallback(
    async (item: ChecklistItem) => {
      if (!task) return;
      setChecklistItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i))
      );
      try {
        await tasksApi.toggleChecklistItem(task.id, item.id, !item.is_done);
        onChecklistChange?.();
      } catch {
        toast({
          title: "Error",
          description: "Failed to update checklist item",
          variant: "error",
        });
        setChecklistItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_done: item.is_done } : i
          )
        );
      }
    },
    [task, onChecklistChange, setChecklistItems]
  );

  const deleteItem = useCallback(
    async (item: ChecklistItem) => {
      if (!task) return;
      setChecklistItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        await tasksApi.removeChecklistItem(task.id, item.id);
        onChecklistChange?.();
      } catch {
        toast({
          title: "Error",
          description: "Failed to delete checklist item",
          variant: "error",
        });
        mutateChecklist();
      }
    },
    [task, onChecklistChange, mutateChecklist, setChecklistItems]
  );

  // ---- Attachment handlers ----

  const handleUpload = useCallback(
    async (file: File) => {
      if (!task || uploading) return;
      setUploading(true);
      try {
        const { url, fileName } = await upload.uploadFile(file);
        const att = await tasksApi.addAttachment(task.id, {
          fileUrl: url,
          fileName,
          fileSize: file.size,
        });
        setAttachments((prev) => [att, ...prev]);
      } catch {
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "error",
        });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [task, uploading, setAttachments]
  );

  const handleDownload = useCallback(async (att: Attachment) => {
    try {
      await downloadFile(att.file_url, att.file_name);
    } catch {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "error",
      });
    }
  }, []);

  const deleteAttachment = useCallback(
    async (att: Attachment) => {
      if (!task) return;
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      try {
        await tasksApi.removeAttachment(task.id, att.id);
      } catch {
        toast({
          title: "Error",
          description: "Failed to delete attachment",
          variant: "error",
        });
        mutateAttachments();
      }
    },
    [task, mutateAttachments, setAttachments]
  );

  return {
    // Checklist
    checklistItems,
    setChecklistItems,
    loadingChecklist,
    newItemTitle,
    setNewItemTitle,
    addingItem,
    addItem,
    toggleItem,
    deleteItem,
    handleDragEnd,
    // Attachments
    attachments,
    loadingAttachments,
    uploading,
    handleUpload,
    handleDownload,
    deleteAttachment,
    fileInputRef,
    // Preview
    previewId,
    setPreviewId,
    previewLoading,
    setPreviewLoading,
    lightboxUrl,
    setLightboxUrl,
  };
}
