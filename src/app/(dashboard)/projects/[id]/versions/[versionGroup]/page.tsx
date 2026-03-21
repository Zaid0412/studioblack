"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Lock, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { attachments } from "@/lib/api";
import { statusBadge, versionColor } from "@/lib/fileUtils";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import type { DbAttachment } from "@/types";

/**
 *
 */
export default function VersionHistoryPage({
  params,
}: {
  params: Promise<{ id: string; versionGroup: string }>;
}) {
  const { id, versionGroup } = use(params);
  const router = useRouter();
  const [versions, setVersions] = useState<DbAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setVersions(await attachments.getVersionHistory(id, versionGroup));
      } catch {
        /* keep empty on failure */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, versionGroup]);

  const latestName = versions[0]?.file_name || "File";

  return (
    <div className="flex flex-col gap-6 max-w-[900px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to project
      </button>

      <PageHeader title="Version History" subtitle={latestName} />

      {loading ? (
        <div className="text-sm text-text-muted">Loading versions...</div>
      ) : versions.length === 0 ? (
        <div className="text-sm text-text-muted">No versions found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v, i) => {
            const badge = statusBadge(v.review_status);
            const color = avatarColor(v.uploaded_by || "");
            const vc = versionColor(v.version || 1);
            const isCurrent = i === 0;

            return (
              <div
                key={v.id}
                className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors cursor-pointer hover:bg-white/[0.02] ${
                  isCurrent
                    ? "border-[#F5C518]/30 bg-[#F5C518]/5"
                    : "border-[#333333] bg-[#1A1A1A]"
                }`}
                onClick={() => router.push(`/projects/${id}/review/${v.id}`)}
              >
                {/* Version badge + icon */}
                <div className="relative shrink-0">
                  <FileText className="w-5 h-5 text-[#A0A0A0]" />
                  <span
                    className={`absolute -top-1.5 -left-1.5 inline-flex items-center justify-center rounded-full ${vc.bg} min-w-[18px] h-[14px] px-1 text-[8px] font-bold ${vc.text} leading-none`}
                  >
                    V{v.version || 1}
                  </span>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {v.file_name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-[#F5C518] bg-[#2A1F00] px-1.5 py-0.5 rounded-full">
                        Latest
                      </span>
                    )}
                    {v.frozen_at && <Lock className="w-3 h-3 text-[#F5C518]" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        {deriveInitials(v.uploaded_by_name || "")}
                      </div>
                      <span className="text-xs text-[#A0A0A0]">
                        {v.uploaded_by_name || "—"}
                      </span>
                    </div>
                    <span className="text-xs text-[#666666]">
                      {new Date(v.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <span
                  className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>

                {/* Download */}
                <button
                  className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(v.file_url, "_blank");
                  }}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
