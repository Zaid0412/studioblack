"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";

interface UseAnnotationTrackerParams {
  viewerRef: RefObject<PDFViewerRef | null>;
  enabled: boolean;
}

/**
 * Tracks annotation create/update/delete events from EmbedPDF.
 * Returns the count of pending annotations and whether the document has changes.
 */
export function useAnnotationTracker({
  viewerRef,
  enabled,
}: UseAnnotationTrackerParams) {
  const [annotationCount, setAnnotationCount] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const setup = useCallback(async () => {
    if (!enabled) return;

    const registry = await viewerRef.current?.registry;
    if (!registry) return;

    const annotationPlugin = registry.getPlugin("annotation");
    if (!annotationPlugin) return;

    const capability = annotationPlugin.provides?.();
    if (!capability) return;

    // Listen to annotation events
    const unsub = capability.onAnnotationEvent(
      (event: { type: string; committed: boolean }) => {
        // Only count committed events (after engine persist)
        if (!event.committed) return;

        if (event.type === "create") {
          setAnnotationCount((c) => c + 1);
          setHasChanges(true);
        } else if (event.type === "delete") {
          setAnnotationCount((c) => Math.max(0, c - 1));
        } else if (event.type === "update") {
          setHasChanges(true);
        }
      }
    );

    unsubRef.current = unsub;
  }, [viewerRef, enabled]);

  useEffect(() => {
    // Delay setup slightly to ensure the viewer is fully loaded
    const timer = setTimeout(setup, 1000);
    return () => {
      clearTimeout(timer);
      unsubRef.current?.();
    };
  }, [setup]);

  /** Export the annotated PDF as an ArrayBuffer. */
  const exportAnnotatedPdf =
    useCallback(async (): Promise<ArrayBuffer | null> => {
      const registry = await viewerRef.current?.registry;
      if (!registry) return null;

      const exportPlugin = registry.getPlugin("export");
      if (!exportPlugin) return null;

      const capability = exportPlugin.provides?.();
      if (!capability) return null;

      try {
        const task = capability.saveAsCopy();
        const buffer = await task.toPromise();
        return buffer;
      } catch (err) {
        console.error("[exportAnnotatedPdf]", err);
        return null;
      }
    }, [viewerRef]);

  const reset = useCallback(() => {
    setAnnotationCount(0);
    setHasChanges(false);
  }, []);

  return {
    annotationCount,
    hasChanges,
    exportAnnotatedPdf,
    reset,
  };
}
