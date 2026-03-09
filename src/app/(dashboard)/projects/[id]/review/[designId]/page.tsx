"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { comments, getProjectById } from "@/data/mock";

export default function DesignReviewPage({
  params,
}: {
  params: Promise<{ id: string; designId: string }>;
}) {
  const { id, designId } = use(params);
  const router = useRouter();
  const t = useTranslations("designReview");
  const tc = useTranslations("common");
  const te = useTranslations("emptyStates");
  const [newComment, setNewComment] = useState("");
  const project = getProjectById(id);
  const section = project?.designSections.find((s) => s.id === designId);

  return (
    <div className="flex flex-col h-full -m-8">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-default bg-bg-secondary shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/projects/${id}`)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("backButton")}
          </button>
          <div className="h-5 w-px bg-border-default" />
          <span className="text-sm font-semibold text-text-primary">
            {section?.name || "Design"} — v{section?.version || 1}
          </span>
          {section && (
            <Badge variant={section.status as any}>
              {section.status
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  toast({
                    title: t("rejectedToast"),
                    description: t("rejectedDescription"),
                    variant: "error",
                  })
                }
              >
                <XCircle className="w-4 h-4" />
                {t("reject")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("rejectTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  toast({
                    title: t("changesRequestedToast"),
                    description: t("changesRequestedDescription"),
                    variant: "warning",
                  })
                }
              >
                <AlertTriangle className="w-4 h-4" />
                {t("requestChanges")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("changesRequestedTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={() =>
                  toast({
                    title: t("approvedToast"),
                    description: t("approvedDescription"),
                    variant: "success",
                  })
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                {t("approve")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("approveTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0">
        {/* PDF Viewer (left) */}
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="flex flex-col items-center gap-4 text-text-muted">
            <div className="w-64 h-80 rounded-lg border-2 border-dashed border-border-default flex items-center justify-center">
              <span className="text-sm">{t("pdfPreview")}</span>
            </div>
            <span className="text-xs">{t("pdfPreviewHint")}</span>
          </div>
        </div>

        {/* Review Panel (right) */}
        <div className="w-[420px] border-l border-border-default bg-bg-secondary flex flex-col shrink-0">
          {/* Comments section */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("comments")} ({comments.length})
            </h3>
            {comments.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={te("commentsTitle")}
                description={te("commentsDescription")}
                className="py-8"
              />
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex flex-col gap-2 rounded-xl bg-bg-elevated p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={comment.author.initials} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-text-primary">
                        {comment.author.name}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {formatTimeAgo(comment.createdAt, tc)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          <div className="border-t border-border-default p-4">
            <div className="flex gap-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t("commentPlaceholder")}
                className="flex-1 rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                rows={2}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="self-end"
                    onClick={() => {
                      if (newComment.trim()) {
                        toast({
                          title: t("commentPostedToast"),
                          description: t("commentPostedDescription"),
                        });
                        setNewComment("");
                      }
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("sendComment")}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Converts an ISO timestamp into a human-readable relative time string.
 *
 * Returns localised labels via the supplied `t` function:
 * - < 1 hour  → "Just now"
 * - < 24 hours → "X hours ago"
 * - ≥ 24 hours → "X days ago"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTimeAgo(
  timestamp: string,
  t: (key: string, values?: any) => string
): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return t("justNow");
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  return t("daysAgo", { count: Math.floor(diffHours / 24) });
}
