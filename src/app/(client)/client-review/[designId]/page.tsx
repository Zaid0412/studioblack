"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { comments } from "@/data/mock";
import { branding } from "@/config/branding";

export default function ClientReviewPage({
  params,
}: {
  params: Promise<{ designId: string }>;
}) {
  const { designId } = use(params);
  const t = useTranslations("clientReview");
  const te = useTranslations("emptyStates");
  const [newComment, setNewComment] = useState("");
  const [decision, setDecision] = useState<"none" | "approved" | "changes">(
    "none"
  );

  return (
    <div className="flex flex-col h-screen -m-8">
      {/* Top bar — no sidebar for client review */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-default bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.appName}
              className="h-7 w-7 rounded-md object-contain"
            />
          ) : (
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent">
              <span className="text-sm font-bold text-text-on-accent">
                {branding.appName.charAt(0)}
              </span>
            </div>
          )}
          <span className="text-sm font-semibold text-text-primary">
            {branding.appName}
          </span>
          <div className="h-5 w-px bg-border-default mx-2" />
          <span className="text-sm text-text-secondary">{t("title")}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Document viewer */}
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="flex flex-col items-center gap-4 text-text-muted">
            <div className="w-72 h-96 rounded-lg border-2 border-dashed border-border-default flex items-center justify-center">
              <span className="text-sm">{t("designPreview")}</span>
            </div>
          </div>
        </div>

        {/* Decision panel */}
        <div className="w-[400px] border-l border-border-default bg-bg-secondary flex flex-col shrink-0">
          {/* Decision buttons */}
          <div className="p-5 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              {t("decision")}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={decision === "approved" ? "primary" : "secondary"}
                onClick={() => setDecision("approved")}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t("approved")}
              </Button>
              <Button
                size="sm"
                variant={decision === "changes" ? "primary" : "secondary"}
                onClick={() => setDecision("changes")}
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4" />
                {t("changesRequested")}
              </Button>
            </div>
          </div>

          {/* Comments */}
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
                        {new Date(comment.createdAt).toLocaleDateString()}
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
              <Button size="sm" className="self-end">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
