"use client";

import type { RefObject } from "react";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getPlugin(name: string): Promise<any> {
    const registry = await viewerRef.current?.registry;
    if (!registry) return null;
    return registry.getPlugin(name)?.provides?.() ?? null;
  }

  async function handlePrint() {
    try {
      (await getPlugin("print"))?.print();
    } catch (err) {
      console.error("[handlePrint]", err);
    }
  }

  async function handleScreenshot() {
    try {
      const capture = await getPlugin("capture");
      if (!capture) return;
      capture.toggleMarqueeCapture();
    } catch (err) {
      console.error("[handleScreenshot]", err);
    }
  }

  async function handleFullscreen() {
    try {
      (await getPlugin("fullscreen"))?.toggleFullscreen();
    } catch (err) {
      console.error("[handleFullscreen]", err);
    }
  }

  async function handleDownload() {
    if (!attachment) return;
    try {
      const blob = await upload.downloadFile(attachment.file_url);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[handleDownload]", err);
    }
  }

  return {
    getPlugin,
    handlePrint,
    handleScreenshot,
    handleFullscreen,
    handleDownload,
  };
}
