"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import type { PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  MessageCircle,
  ClipboardCheck,
  Camera,
  Printer,
  Maximize,
} from "lucide-react";

interface ReviewToolbarProps {
  projectId: string;
  fileName: string;
  fileUrl: string;
  viewerRef: RefObject<PDFViewerRef | null>;
  reviewsOpen: boolean;
  reviewCount: number;
  setReviewsOpen: (open: boolean) => void;
  handleScreenshot: () => void;
  handleDownload: () => void;
  handlePrint: () => void;
  handleFullscreen: () => void;
}

/**
 *
 */
export function ReviewToolbar({
  projectId,
  fileName,
  fileUrl,
  viewerRef,
  reviewsOpen,
  reviewCount,
  setReviewsOpen,
  handleScreenshot,
  handleDownload,
  handlePrint,
  handleFullscreen,
}: ReviewToolbarProps) {
  const router = useRouter();
  const t = useTranslations("designReview");

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [commentToolActive, setCommentToolActive] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // Close more menu on click outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreMenuOpen]);

  return (
    <div className="h-10 shrink-0 bg-[#1A1A1A] px-3 flex items-center justify-between gap-2">
      {/* Left: Back + filename */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0"
          title="Back to project"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-white text-[13px] font-medium truncate">
          {fileName}
        </span>
      </div>

      {/* Right: Utility icons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Reviews toggle — pill button with count */}
        <button
          onClick={() => setReviewsOpen(!reviewsOpen)}
          className={`cursor-pointer transition-colors flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
            reviewsOpen
              ? "bg-[#F5C518]/15 text-[#F5C518]"
              : reviewCount > 0
                ? "bg-[#242424] text-[#A0A0A0] hover:text-white"
                : "text-[#A0A0A0] hover:text-white"
          }`}
          title="Reviews"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          {reviewCount > 0 && <span>{reviewCount}</span>}
        </button>

        <div className="w-px h-4 bg-[#333]" />

        <button
          onClick={toggleCommentTool}
          className={`cursor-pointer transition-colors ${commentToolActive ? "text-[#F5C518]" : "text-[#A0A0A0] hover:text-white"}`}
          title="Comment tool"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          onClick={handleScreenshot}
          className="text-[#A0A0A0] hover:text-white cursor-pointer"
          title="Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownload}
          className="text-[#A0A0A0] hover:text-white cursor-pointer"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* More options dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <button
            className="text-[#A0A0A0] hover:text-white cursor-pointer"
            title="More options"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
          >
            <Ellipsis className="w-4 h-4" />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#242424] border border-[#333333] rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={() => {
                  handlePrint();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => {
                  handleFullscreen();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
              >
                <Maximize className="w-4 h-4" />
                Fullscreen
              </button>
              <a
                href={`/api/proxy-file?url=${encodeURIComponent(fileUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
