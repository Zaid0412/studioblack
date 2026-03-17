"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Loader2,
  Camera,
  Printer,
  Maximize,
} from "lucide-react";

interface ReviewToolbarProps {
  projectId: string;
  fileName: string;
  fileUrl: string;
  commentsOpen: boolean;
  setCommentsOpen: (open: boolean) => void;
  reviewingAs: "approved" | "rejected" | null;
  handleReview: (status: "approved" | "rejected") => void;
  handleScreenshot: () => void;
  handleDownload: () => void;
  handlePrint: () => void;
  handleFullscreen: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlugin: (name: string) => Promise<any>;
}

/**
 *
 */
export function ReviewToolbar({
  projectId,
  fileName,
  fileUrl,
  commentsOpen,
  setCommentsOpen,
  reviewingAs,
  handleReview,
  handleScreenshot,
  handleDownload,
  handlePrint,
  handleFullscreen,
  getPlugin,
}: ReviewToolbarProps) {
  const router = useRouter();
  const t = useTranslations("designReview");

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

      {/* Right: Utility + Approve/Reject */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          className={`cursor-pointer transition-colors ${commentsOpen ? "text-[#F5C518]" : "text-[#A0A0A0] hover:text-white"}`}
          onClick={async () => {
            const willOpen = !commentsOpen;
            setCommentsOpen(willOpen);
            try {
              const plugin = await getPlugin("annotation");
              plugin?.setActiveTool(willOpen ? "textComment" : null);
            } catch (err) {
              console.error("[toggleComment]", err);
            }
          }}
          title="Toggle comments panel"
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

        <div className="w-px h-5 bg-[#333333]" />

        <button
          onClick={() => handleReview("approved")}
          disabled={reviewingAs !== null}
          className="flex items-center gap-1 border border-[#22C55E] text-[#22C55E] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#22C55E]/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {reviewingAs === "approved" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          {t("approve")}
        </button>
        <button
          onClick={() => handleReview("rejected")}
          disabled={reviewingAs !== null}
          className="flex items-center gap-1 border border-[#EF4444] text-[#EF4444] rounded-md px-2.5 py-1 text-xs font-medium hover:bg-[#EF4444]/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {reviewingAs === "rejected" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          {t("reject")}
        </button>
      </div>
    </div>
  );
}
