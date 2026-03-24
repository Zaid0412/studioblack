"use client";

import { useCallback, type RefObject } from "react";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { upload } from "@/lib/api";
import type { DbAttachment } from "@/types";

interface UsePdfPluginsParams {
  viewerRef: RefObject<PDFViewerRef | null>;
  attachment: DbAttachment | null;
}

/**
 * Provides helpers for interacting with EmbedPDF viewer plugins
 * (print, screenshot, fullscreen, download).
 */
export function usePdfPlugins({ viewerRef, attachment }: UsePdfPluginsParams) {
  const getPlugin = useCallback(
    async (
      name: string
    ): Promise<Record<string, (...args: unknown[]) => unknown> | null> => {
      const registry = await viewerRef.current?.registry;
      if (!registry) return null;
      return registry.getPlugin(name)?.provides?.() ?? null;
    },
    [viewerRef]
  );

  const handlePrint = useCallback(async () => {
    try {
      (await getPlugin("print"))?.print();
    } catch (err) {
      console.error("[handlePrint]", err);
    }
  }, [getPlugin]);

  const handleScreenshot = useCallback(async () => {
    try {
      const capture = await getPlugin("capture");
      if (!capture) return;
      capture.toggleMarqueeCapture();
    } catch (err) {
      console.error("[handleScreenshot]", err);
    }
  }, [getPlugin]);

  const handleFullscreen = useCallback(async () => {
    try {
      (await getPlugin("fullscreen"))?.toggleFullscreen();
    } catch (err) {
      console.error("[handleFullscreen]", err);
    }
  }, [getPlugin]);

  const handleDownload = useCallback(async () => {
    if (!attachment) return;
    try {
      const blob = await upload.downloadFile(attachment.file_url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }, [attachment]);

  return {
    getPlugin,
    handlePrint,
    handleScreenshot,
    handleFullscreen,
    handleDownload,
  };
}
