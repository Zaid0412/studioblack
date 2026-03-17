"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/use-toast";
import type { DbAttachment, DbComment, DbPhase } from "@/types";

interface UseDesignReviewParams {
  projectId: string;
  designId: string;
}

/**
 *
 */
export function useDesignReview({
  projectId,
  designId,
}: UseDesignReviewParams) {
  const t = useTranslations("designReview");

  const [activeFileId, setActiveFileId] = useState(designId);
  const [attachment, setAttachment] = useState<DbAttachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<DbAttachment[]>([]);
  const [phaseName, setPhaseName] = useState<string>("");
  const [comments, setComments] = useState<DbComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reviewingAs, setReviewingAs] = useState<
    "approved" | "rejected" | null
  >(null);

  const fetchAttachment = useCallback(
    async (fileId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/attachments/${fileId}`
      );
      if (!res.ok) return null;
      return (await res.json()) as DbAttachment;
    },
    [projectId]
  );

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/comments`);
    if (!res.ok) return [];
    return (await res.json()) as DbComment[];
  }, [projectId]);

  const fetchPhaseFiles = useCallback(
    async (phaseId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/attachments?phaseId=${phaseId}`
      );
      if (!res.ok) return [];
      return (await res.json()) as DbAttachment[];
    },
    [projectId]
  );

  const fetchPhaseName = useCallback(
    async (phaseId: string) => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) return "";
      const data = await res.json();
      const phase = data.phases?.find((p: DbPhase) => p.id === phaseId);
      return phase?.name || "";
    },
    [projectId]
  );

  const isInitialLoad = useRef(true);

  // Fetch attachment + sidebar data whenever activeFileId changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const isFirst = isInitialLoad.current;
      if (isFirst) {
        isInitialLoad.current = false;
        setLoading(true);
      }

      const att = await fetchAttachment(activeFileId);
      if (cancelled) return;
      setAttachment(att);

      if (isFirst) {
        const cmts = await fetchComments();
        if (cancelled) return;
        setComments(cmts);

        if (att?.phase_id) {
          const [files, name] = await Promise.all([
            fetchPhaseFiles(att.phase_id),
            fetchPhaseName(att.phase_id),
          ]);
          if (cancelled) return;
          setPhaseFiles(files);
          setPhaseName(name);
        }
      }

      if (!isFirst && activeFileId !== designId) {
        window.history.replaceState(
          null,
          "",
          `/projects/${projectId}/review/${activeFileId}`
        );
      }

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);

  async function handleReview(status: "approved" | "rejected") {
    setReviewingAs(status);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/attachments/${activeFileId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to update review status.",
          variant: "error",
        });
        return;
      }
      toast({
        title: status === "approved" ? t("approvedToast") : t("rejectedToast"),
        description:
          status === "approved"
            ? t("approvedDescription")
            : t("rejectedDescription"),
        variant: status === "approved" ? "success" : "error",
      });
      const updated = await fetchAttachment(activeFileId);
      if (updated) setAttachment(updated);
    } finally {
      setReviewingAs(null);
    }
  }

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to post comment.",
          variant: "error",
        });
        return;
      }
      toast({
        title: t("commentPostedToast"),
        description: t("commentPostedDescription"),
      });
      setNewComment("");
      const updated = await fetchComments();
      setComments(updated);
    } finally {
      setSubmittingComment(false);
    }
  }

  return {
    activeFileId,
    setActiveFileId,
    attachment,
    phaseFiles,
    phaseName,
    comments,
    newComment,
    setNewComment,
    commentsOpen,
    setCommentsOpen,
    loading,
    submittingComment,
    reviewingAs,
    handleReview,
    handlePostComment,
  };
}
