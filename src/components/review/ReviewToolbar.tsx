"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  MapPin,
  Printer,
  Lock,
  Maximize,
  Unlock,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ReviewToolbarProps {
  backPath: string;
  fileName: string;
  fileUrl: string;
  pinModeActive: boolean;
  onTogglePinMode: () => void;
  onDownload: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  onUploadNewVersion?: () => void;
  frozen?: boolean;
  onToggleFreeze?: () => void;
}

/**
 * Shared toolbar for design review pages.
 */
export function ReviewToolbar({
  backPath,
  fileName,
  fileUrl,
  pinModeActive,
  onTogglePinMode,
  onDownload,
  leftSlot,
  rightSlot,
  onUploadNewVersion,
  frozen,
  onToggleFreeze,
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => router.push(backPath)}
              className="text-[#A0A0A0] hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to project</TooltipContent>
        </Tooltip>
        <span className="text-white text-[13px] font-medium truncate">
          {fileName}
        </span>
        {leftSlot}
      </div>

      {/* Right: Utility icons */}
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {rightSlot && <div className="w-px h-4 bg-[#333]" />}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onTogglePinMode}
              className={`cursor-pointer transition-colors ${pinModeActive ? "text-[#F5C518]" : "text-[#A0A0A0] hover:text-white"}`}
            >
              <MapPin className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Pin comment</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDownload}
              className="text-[#A0A0A0] hover:text-white cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download file</TooltipContent>
        </Tooltip>

        {/* More options dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-[#A0A0A0] hover:text-white cursor-pointer"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              >
                <Ellipsis className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">More options</TooltipContent>
          </Tooltip>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#242424] border border-[#333333] rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={() => {
                  window.print();
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => {
                  document.documentElement.requestFullscreen?.();
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
              {onToggleFreeze && (
                <button
                  onClick={() => {
                    onToggleFreeze();
                    setMoreMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[#A0A0A0] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  {frozen ? (
                    <Unlock className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {frozen ? "Unfreeze File" : "Freeze File"}
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
