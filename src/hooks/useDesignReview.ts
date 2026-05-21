"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
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

  // -- Active attachment (SWR) --
  // `keepPreviousData` keeps the previous attachment in `data` while the new
  // one is in flight, so switching files doesn't drop `isLoading` back to true
  // and unmount the rest of the page (file list, toolbar, comments).
  const {
    data: attachmentData,
    isLoading: loading,
    mutate: mutateAttachment,
  } = useSWR<DbAttachment>(
    `/api/projects/${projectId}/attachments/${activeFileId}`,
    { keepPreviousData: true }
  );

  const attachment = attachmentData ?? null;

  // -- Reviews (SWR, conditional) --
  const { data: reviews = [] } = useSWR<DbAttachmentReview[]>(
    fetchReviews
      ? `/api/projects/${projectId}/attachments/${activeFileId}/review`
      : null
  );

  // -- Phase files: determined once from the first attachment's phase_id --
  // `undefined` = not yet determined, `null` = no phase, `string` = phase id
  const [initialPhaseId, setInitialPhaseId] = useState<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    if (attachmentData && initialPhaseId === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from fetched data
      setInitialPhaseId(attachmentData.phase_id || null);
    }
  }, [attachmentData, initialPhaseId]);

  const phaseFilesKey =
    initialPhaseId !== undefined
      ? initialPhaseId
        ? `/api/projects/${projectId}/attachments?phaseId=${initialPhaseId}`
        : `/api/projects/${projectId}/attachments?all=true`
      : null;

  const { data: phaseFiles = [], isLoading: filesLoading } =
    useSWR<DbAttachment[]>(phaseFilesKey);

  // -- Phase name from project data (shares SWR cache with useProjectDetail) --
  const { data: projectData } = useSWR<{ phases?: DbPhase[] }>(
    initialPhaseId ? `/api/projects/${projectId}` : null
  );

  const phaseName = useMemo(() => {
    if (!initialPhaseId || !projectData?.phases) return "";
    return projectData.phases.find((p) => p.id === initialPhaseId)?.name || "";
  }, [initialPhaseId, projectData]);

  // -- URL replacement on file switch --
  useEffect(() => {
    if (activeFileId !== designId) {
      window.history.replaceState(
        null,
        "",
        `${basePath}/${projectId}/review/${activeFileId}`
      );
    }
  }, [activeFileId, designId, basePath, projectId]);

  // -- Helpers for consumer mutations --
  const refreshAttachment = useCallback(
    () => mutateAttachment(),
    [mutateAttachment]
  );

  const updateAttachment = useCallback(
    (updater: (prev: DbAttachment | null) => DbAttachment | null) => {
      mutateAttachment(
        (prev) => {
          const result = updater(prev ?? null);
          return result ?? undefined;
        },
        { revalidate: false }
      );
    },
    [mutateAttachment]
  );

  return {
    activeFileId,
    setActiveFileId,
    attachment,
    updateAttachment,
    refreshAttachment,
    phaseFiles,
    filesLoading,
    phaseName,
    loading,
    reviews,
  };
}
