"use client";

import { useState, useEffect } from "react";
import type { DbAttachment, DbComment, DbProjectDetail } from "@/types";

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
      fetch(`/api/projects/${id}`).then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      }),
      fetch(`/api/projects/${id}/attachments?all=true`).then((res) =>
        res.ok ? res.json() : []
      ),
      fetch(`/api/projects/${id}/comments`).then((res) =>
        res.ok ? res.json() : []
      ),
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
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/projects/${id}/comments`).then((r) =>
          r.ok ? r.json() : []
        );
        setComments(updated);
        setNewComment("");
      }
    } finally {
      setSendingComment(false);
    }
  };

  const handleDownload = async (att: DbAttachment) => {
    try {
      const res = await fetch(
        `/api/proxy-file?url=${encodeURIComponent(att.file_url)}`
      );
      if (!res.ok) return;
      const blob = await res.blob();
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
  };
}
