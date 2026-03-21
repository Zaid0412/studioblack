"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  MessageCircle,
  Camera,
  Printer,
  Maximize,
  Upload,
} from "lucide-react";

interface ReviewToolbarProps {
  /** Where the back button navigates to */
  backPath: string;
  fileName: string;
  fileUrl: string;
  commentToolActive: boolean;
  onToggleCommentTool: () => void;
  onScreenshot: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onFullscreen: () => void;
  /** Slot rendered after the filename (e.g. status badge) */
  leftSlot?: ReactNode;
  /** Slot rendered before the comment button (e.g. reviews toggle) */
  rightSlot?: ReactNode;
  /** Called when "Upload New Version" is clicked in the more menu */
  onUploadNewVersion?: () => void;
}

/**
 * Shared toolbar for design review pages.
 */
export function ReviewToolbar({
  backPath,
  fileName,
  fileUrl,
  commentToolActive,
  onToggleCommentTool,
  onScreenshot,
  onDownload,
  onPrint,
  onFullscreen,
  leftSlot,
  rightSlot,
  onUploadNewVersion,
}: ReviewToolbarProps) {
  const router = useRouter();
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
      {/* Left: Back + filename + leftSlot */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={() => router.push(backPath)}
          className="text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0"
          title="Back to project"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-white text-[13px] font-medium truncate">
          {fileName}
        </span>
        {leftSlot}
      </div>

      {/* Right: Utility icons */}
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {rightSlot && <div className="w-px h-4 bg-[#333]" />}

        <button
          onClick={onToggleCommentTool}
          className={`cursor-pointer transition-colors ${commentToolActive ? "text-[#F5C518]" : "text-[#A0A0A0] hover:text-white"}`}
          title="Comment tool"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          onClick={onScreenshot}
          className="text-[#A0A0A0] hover:text-white cursor-pointer"
          title="Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={onDownload}
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
                  onPrint();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => {
                  onFullscreen();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
              >
                <Maximize className="w-4 h-4" />
                Fullscreen
              </button>
              {onUploadNewVersion && (
                <button
                  onClick={() => {
                    onUploadNewVersion();
                    setMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload New Version
                </button>
              )}
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
