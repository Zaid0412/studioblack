"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Ellipsis,
  History,
  Printer,
  Lock,
  Maximize,
  Send,
  Stamp,
  Unlock,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/DropdownMenu";

interface ReviewToolbarProps {
  backPath: string;
  fileName: string;
  fileUrl: string;
  onDownload: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  onUploadNewVersion?: () => void;
  onSendToClient?: () => void;
  frozen?: boolean;
  onToggleFreeze?: () => void;
  /** PM issues the current version as the next revision (Document Control). */
  onIssueRevision?: () => void;
  /** Current revision tag, e.g. `Rev 02`. Shown next to the issue action. */
  currentRevLabel?: string | null;
}

/**
 * Shared toolbar for design review pages.
 */
export function ReviewToolbar({
  backPath,
  fileName,
  fileUrl,
  onDownload,
  leftSlot,
  rightSlot,
  onUploadNewVersion,
  onSendToClient,
  frozen,
  onToggleFreeze,
  onIssueRevision,
  currentRevLabel,
}: ReviewToolbarProps) {
  const router = useRouter();

  return (
    <div className="h-10 shrink-0 bg-bg-secondary px-3 flex items-center justify-between gap-2">
      {/* Left: Back + filename + leftSlot */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => router.push(backPath)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to project</TooltipContent>
        </Tooltip>
        <span className="text-text-primary text-[13px] font-medium truncate">
          {fileName}
        </span>
        {/* Current revision — file metadata, shown by the name (not the action row) */}
        {currentRevLabel && (
          <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-elevated border border-border-default text-[11px] font-semibold text-text-secondary">
            <History className="w-3 h-3 text-accent" />
            {currentRevLabel}
          </span>
        )}
        {leftSlot}
      </div>

      {/* Right: grouped utilities — panels │ file │ workflow │ overflow.
          Each group is divided so related controls read together instead of a
          flat row of mixed icons and buttons. */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Group 1 — info panels (Comments · Reviews · Revisions) */}
        {rightSlot}

        {/* Group 2 — file utilities (view / get the file) */}
        {rightSlot && <div className="w-px h-4 bg-border-default" />}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fullscreen</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDownload}
              className="text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download file</TooltipContent>
        </Tooltip>
        {onUploadNewVersion && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onUploadNewVersion}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <Upload className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Upload new version</TooltipContent>
          </Tooltip>
        )}

        {/* Group 3 — workflow actions (act on the file), primary CTA last */}
        {(onToggleFreeze || onIssueRevision || onSendToClient) && (
          <div className="w-px h-4 bg-border-default" />
        )}
        {onToggleFreeze && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleFreeze}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                {frozen ? (
                  <Unlock className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {frozen ? "Unfreeze file" : "Freeze file"}
            </TooltipContent>
          </Tooltip>
        )}
        {onIssueRevision && (
          <button
            onClick={onIssueRevision}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-accent text-accent text-[12px] font-semibold cursor-pointer hover:bg-accent/10 transition-colors"
          >
            <Stamp className="w-3.5 h-3.5" />
            Issue Revision
          </button>
        )}
        {onSendToClient && (
          <button
            onClick={onSendToClient}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent text-text-on-accent text-[12px] font-semibold cursor-pointer hover:bg-accent-hover transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send to Client
          </button>
        )}

        {/* Overflow — Print / Open in new tab */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More options"
                  className="text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <Ellipsis className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">More options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => window.print()}>
              <Printer />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/proxy-file?url=${encodeURIComponent(fileUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Open in new tab
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
