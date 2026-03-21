import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/useToast";
import { tasks as tasksApi, upload } from "@/lib/api";
import type { Task } from "@/types";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  standalone_task_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 *
 */
export function useTaskDetail(
  task: Task | null,
  open: boolean,
  onChecklistChange?: () => void
) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Data fetching ----

  const fetchChecklist = useCallback(async (taskId: string) => {
    setLoadingChecklist(true);
    try {
      const items = await tasksApi.getChecklist<ChecklistItem>(taskId);
      setChecklistItems(items);
    } catch {
      // ignore
    } finally {
      setLoadingChecklist(false);
    }
  }, []);

  const fetchAttachments = useCallback(async (taskId: string) => {
    setLoadingAttachments(true);
    try {
      const items = await tasksApi.getAttachments<Attachment>(taskId);
      setAttachments(items);
    } catch {
      // ignore
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

  useEffect(() => {
    if (open && task?.id) {
      fetchChecklist(task.id);
      fetchAttachments(task.id);
    } else {
      setChecklistItems([]);
      setNewItemTitle("");
      setAttachments([]);
      setPreviewId(null);
      setPreviewLoading(null);
      setLightboxUrl(null);
    }
  }, [open, task?.id, fetchChecklist, fetchAttachments]);

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
        fetchChecklist(task.id);
      }
    },
    [checklistItems, task, fetchChecklist]
  );

  const addItem = useCallback(async () => {
    if (!task || !newItemTitle.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const item = await tasksApi.addChecklistItem<ChecklistItem>(
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
  }, [task, newItemTitle, addingItem, onChecklistChange]);

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
    [task, onChecklistChange]
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
        fetchChecklist(task.id);
      }
    },
    [task, onChecklistChange, fetchChecklist]
  );

  // ---- Attachment handlers ----

  const handleUpload = useCallback(
    async (file: File) => {
      if (!task || uploading) return;
      setUploading(true);
      try {
        const { url, fileName } = await upload.uploadFile(file);
        const att = await tasksApi.addAttachment<Attachment>(task.id, {
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
    [task, uploading]
  );

  const handleDownload = useCallback(async (att: Attachment) => {
    try {
      const blob = await upload.downloadFile(att.file_url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name;
      a.click();
      URL.revokeObjectURL(url);
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
        fetchAttachments(task.id);
      }
    },
    [task, fetchAttachments]
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
