"use client";

import { useState } from "react";
import type { RefObject } from "react";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";

interface UseCommentToolParams {
  viewerRef: RefObject<PDFViewerRef | null>;
}

/**
 * Toggles EmbedPDF's built-in text comment annotation tool.
 */
export function useCommentTool({ viewerRef }: UseCommentToolParams) {
  const [commentToolActive, setCommentToolActive] = useState(false);

  async function toggleCommentTool() {
    const willActivate = !commentToolActive;
    setCommentToolActive(willActivate);
    try {
      const registry = await viewerRef.current?.registry;
      const plugin = registry?.getPlugin("annotation");
      const capability = plugin?.provides?.();
      capability?.setActiveTool(willActivate ? "textComment" : null);
    } catch (err) {
      console.error("[toggleCommentTool]", err);
    }
  }

  return { commentToolActive, toggleCommentTool };
}
