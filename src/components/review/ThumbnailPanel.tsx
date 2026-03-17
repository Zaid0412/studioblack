"use client";

import { FileText, Image, FileIcon, Loader2 } from "lucide-react";
import { isPdf, isImage } from "@/lib/fileUtils";
import type { DbAttachment } from "@/types";

interface ThumbnailPanelProps {
  phaseFiles: DbAttachment[];
  activeFileId: string;
  phaseName: string;
  loading: boolean;
  onSelectFile: (fileId: string) => void;
}

function FileTypeIcon({ name }: { name: string }) {
  if (isPdf(name)) return <FileText className="w-4 h-4 shrink-0" />;
  if (isImage(name)) return <Image className="w-4 h-4 shrink-0" />;
  return <FileIcon className="w-4 h-4 shrink-0" />;
}

function statusDot(status?: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-red-500";
  if (status === "changes_requested") return "bg-amber-500";
  return "bg-[#555]";
}

/**
 *
 */
export function ThumbnailPanel({
  phaseFiles,
  activeFileId,
  phaseName,
  loading,
  onSelectFile,
}: ThumbnailPanelProps) {
  return (
    <div className="w-56 shrink-0 bg-[#0D0D0D] border-r border-[#222] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#222]">
        <p className="text-[11px] font-medium text-[#666] uppercase tracking-wider">
          {phaseName || "Files"}
        </p>
        {!loading && (
          <p className="text-[11px] text-[#555] mt-0.5">
            {phaseFiles.length} file{phaseFiles.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-[#555]" />
          </div>
        ) : phaseFiles.length === 0 ? (
          <p className="text-[11px] text-[#555] px-3 py-4">No files found</p>
        ) : (
          phaseFiles.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <button
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#1A1A1A] border-l-2 border-[#F5C518]"
                    : "border-l-2 border-transparent hover:bg-[#141414]"
                }`}
              >
                <div className={isActive ? "text-[#F5C518]" : "text-[#666]"}>
                  <FileTypeIcon name={file.file_name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] truncate ${
                      isActive ? "text-white font-medium" : "text-[#A0A0A0]"
                    }`}
                  >
                    {file.file_name}
                  </p>
                  {file.version && file.version > 1 && (
                    <span className="text-[10px] text-[#F5C518]">
                      V{file.version}
                    </span>
                  )}
                </div>
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${statusDot(file.review_status)}`}
                  title={file.review_status || "pending"}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
