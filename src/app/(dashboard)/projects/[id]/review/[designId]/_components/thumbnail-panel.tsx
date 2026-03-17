"use client";

import { FileText } from "lucide-react";
import type { DbAttachment } from "@/types";

interface ThumbnailPanelProps {
  phaseFiles: DbAttachment[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
}

/**
 *
 */
export function ThumbnailPanel({
  phaseFiles,
  activeFileId,
  onSelectFile,
}: ThumbnailPanelProps) {
  return (
    <div className="w-16 shrink-0 bg-[#0D0D0D] py-4 px-2 flex flex-col items-center gap-2 overflow-y-auto">
      {phaseFiles.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <button
            key={file.id}
            onClick={() => onSelectFile(file.id)}
            className={`w-12 h-14 rounded-sm flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              isActive
                ? "bg-[#1A1A1A] border-2 border-[#F5C518]"
                : "bg-[#242424] border border-[#333333] hover:border-[#555555]"
            }`}
          >
            <FileText
              className={`w-5 h-5 ${
                isActive ? "text-[#F5C518]" : "text-[#666666]"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
