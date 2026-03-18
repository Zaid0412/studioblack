"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DbAttachment, DbAttachmentReview, DbPhase } from "@/types";

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
  const [activeFileId, setActiveFileId] = useState(designId);
  const [attachment, setAttachment] = useState<DbAttachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<DbAttachment[]>([]);
  const [phaseName, setPhaseName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  const [reviews, setReviews] = useState<DbAttachmentReview[]>([]);

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

  const fetchAllFiles = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/attachments?all=true`);
    if (!res.ok) return [];
    return (await res.json()) as DbAttachment[];
  }, [projectId]);

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
        setLoading(true);
      }

      const att = await fetchAttachment(activeFileId);
      if (cancelled) return;
      setAttachment(att);

      if (isFirst) {
        isInitialLoad.current = false;
        const reviewData = await fetch(
          `/api/projects/${projectId}/attachments/${activeFileId}/review`
        ).then((r) => (r.ok ? r.json() : []));
        if (cancelled) return;
        setReviews(reviewData);

        if (att?.phase_id) {
          const [files, name] = await Promise.all([
            fetchPhaseFiles(att.phase_id),
            fetchPhaseName(att.phase_id),
          ]);
          if (cancelled) return;
          setPhaseFiles(files);
          setPhaseName(name);
        } else {
          // No phase — load all project files so sidebar isn't empty
          const files = await fetchAllFiles();
          if (cancelled) return;
          setPhaseFiles(files);
        }
        setFilesLoading(false);
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

  return {
    activeFileId,
    setActiveFileId,
    attachment,
    phaseFiles,
    filesLoading,
    phaseName,
    loading,
    reviews,
  };
}
