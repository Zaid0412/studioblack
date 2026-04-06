"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  attachments as attachmentsApi,
  projects as projectsApi,
} from "@/lib/api";
import type { DbAttachment, DbAttachmentReview, DbPhase } from "@/types";

interface UseDesignReviewParams {
  projectId: string;
  designId: string;
  /** Base path for URL replacement when switching files (e.g. "/projects") */
  basePath: string;
  /** Whether to fetch review history on initial load. Default: false. */
  fetchReviews?: boolean;
}

/**
 * Shared data-fetching hook for design review pages.
 * Loads attachment, phase files, and optionally review history.
 */
export function useDesignReview({
  projectId,
  designId,
  basePath,
  fetchReviews = false,
}: UseDesignReviewParams) {
  const [activeFileId, setActiveFileId] = useState(designId);
  const [attachment, setAttachment] = useState<DbAttachment | null>(null);
  const [phaseFiles, setPhaseFiles] = useState<DbAttachment[]>([]);
  const [phaseName, setPhaseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  const [reviews, setReviews] = useState<DbAttachmentReview[]>([]);

  const fetchAttachment = useCallback(
    async (fileId: string) => {
      try {
        return await attachmentsApi.get(projectId, fileId);
      } catch {
        return null;
      }
    },
    [projectId]
  );

  const fetchPhaseFiles = useCallback(
    async (phaseId: string) => {
      try {
        return await attachmentsApi.list(projectId, { phaseId });
      } catch {
        return [];
      }
    },
    [projectId]
  );

  const fetchAllFiles = useCallback(async () => {
    try {
      return await attachmentsApi.list(projectId, { all: true });
    } catch {
      return [];
    }
  }, [projectId]);

  const fetchPhaseName = useCallback(
    async (phaseId: string) => {
      try {
        const data = await projectsApi.get<{ phases?: DbPhase[] }>(projectId);
        const phase = data.phases?.find((p: DbPhase) => p.id === phaseId);
        return phase?.name || "";
      } catch {
        return "";
      }
    },
    [projectId]
  );

  const isInitialLoad = useRef(true);

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

      if (fetchReviews) {
        try {
          const reviewData = await attachmentsApi.getReviewHistory(
            projectId,
            activeFileId
          );
          if (cancelled) return;
          setReviews(reviewData);
        } catch {
          if (!cancelled) setReviews([]);
        }
      }

      if (isFirst) {
        isInitialLoad.current = false;

        if (att?.phase_id) {
          const [files, name] = await Promise.all([
            fetchPhaseFiles(att.phase_id),
            fetchPhaseName(att.phase_id),
          ]);
          if (cancelled) return;
          setPhaseFiles(files);
          setPhaseName(name);
        } else {
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
          `${basePath}/${projectId}/review/${activeFileId}`
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
    setAttachment,
    fetchAttachment,
    phaseFiles,
    filesLoading,
    phaseName,
    loading,
    reviews,
  };
}
