"use client";

import { FileText, Image, FileIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { isPdf, isImage } from "@/lib/fileUtils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { DbAttachment } from "@/types";

interface ThumbnailPanelProps {
  phaseFiles: DbAttachment[];
  activeFileId: string;
  phaseName: string;
  loading: boolean;
  onSelectFile: (fileId: string) => void;
}

function FileTypeIcon({ name }: { name: string }) {
  if (isPdf(name))
    return <FileText className="w-4 h-4 shrink-0" aria-label="PDF file" />;
  if (isImage(name))
    return <Image className="w-4 h-4 shrink-0" aria-label="Image file" />;
  return <FileIcon className="w-4 h-4 shrink-0" aria-label="File" />;
}

function statusDot(status?: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-red-500";
  if (status === "changes_requested") return "bg-amber-500";
  return "bg-text-muted";
}

/** Sidebar panel listing phase files with active selection and review status indicators. */
export function ThumbnailPanel({
  phaseFiles,
  activeFileId,
  phaseName,
  loading,
  onSelectFile,
}: ThumbnailPanelProps) {
  return (
    <div className="hidden lg:flex w-40 shrink-0 bg-bg-primary border-r border-border-default flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border-default">
        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          {phaseName || "Files"}
        </p>
        {!loading && (
          <p className="text-[11px] text-text-muted mt-0.5">
            {phaseFiles.length} file{phaseFiles.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex flex-col py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 border-l-2 border-transparent"
              >
                <Skeleton className="w-4 h-4 rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-8 mt-1" />
                </div>
                <Skeleton className="w-2 h-2 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        ) : phaseFiles.length === 0 ? (
          <p className="text-[11px] text-text-muted px-3 py-4">
            No files found
          </p>
        ) : (
          phaseFiles.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <button
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-bg-secondary border-l-2 border-accent"
                    : "border-l-2 border-transparent hover:bg-bg-secondary"
                }`}
              >
                <div className={isActive ? "text-accent" : "text-text-muted"}>
                  <FileTypeIcon name={file.file_name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] truncate ${
                      isActive
                        ? "text-text-primary font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    {file.file_name}
                  </p>
                  {file.version && file.version > 1 && (
                    <span className="text-[10px] text-accent">
                      V{file.version}
                    </span>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${statusDot(file.review_status)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {file.review_status || "pending"}
                  </TooltipContent>
                </Tooltip>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
