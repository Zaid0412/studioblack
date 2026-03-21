"use client";

import { useState, useEffect, useCallback } from "react";
import type { DbAttachment, DbComment, DbProjectDetail } from "@/types";
import {
  projects as projectsApi,
  attachments as attachmentsApi,
  comments as commentsApi,
  upload,
} from "@/lib/api";

/** Hook that fetches and manages project detail, attachments, and comments. */
export function useProjectDetail(id: string) {
  const [project, setProject] = useState<DbProjectDetail | null>(null);
  const [attachments, setAttachments] = useState<DbAttachment[]>([]);
  const [comments, setComments] = useState<DbComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  // Fetch project data
  useEffect(() => {
    Promise.all([
      projectsApi.get<DbProjectDetail>(id),
      attachmentsApi.list(id, { all: true }).catch(() => [] as DbAttachment[]),
      commentsApi.list(id).catch(() => [] as DbComment[]),
    ])
      .then(([projectData, attachData, commentData]) => {
        setProject(projectData);
        setAttachments(attachData);
        setComments(commentData);
        // Default to first phase
        if (projectData.phases?.length > 0) {
          setActivePhaseId(projectData.phases[0].id);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendComment = async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await commentsApi.create(id, newComment.trim());
      const updated = await commentsApi.list(id).catch(() => [] as DbComment[]);
      setComments(updated);
      setNewComment("");
    } catch {
      // Original code silently ignored post failures
    } finally {
      setSendingComment(false);
    }
  };

  const refreshAttachments = useCallback(async () => {
    try {
      const data = await attachmentsApi.list(id, { all: true });
      setAttachments(data);
    } catch {
      // Original code silently ignored failures
    }
  }, [id]);

  const refreshAll = useCallback(async () => {
    const [projectData, attachData, commentData] = await Promise.all([
      projectsApi.get<DbProjectDetail>(id).catch(() => null),
      attachmentsApi.list(id, { all: true }).catch(() => [] as DbAttachment[]),
      commentsApi.list(id).catch(() => [] as DbComment[]),
    ]);
    if (projectData) setProject(projectData);
    setAttachments(attachData);
    setComments(commentData);
  }, [id]);

  const handleDownload = async (att: DbAttachment) => {
    try {
      const blob = await upload.downloadFile(att.file_url);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  };

  return {
    project,
    attachments,
    comments,
    newComment,
    setNewComment,
    sendingComment,
    loading,
    error,
    activePhaseId,
    setActivePhaseId,
    handleSendComment,
    handleDownload,
    refreshAttachments,
    refreshAll,
  };
}
