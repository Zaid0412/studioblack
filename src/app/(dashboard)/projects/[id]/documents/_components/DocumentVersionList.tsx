"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  ChevronDown,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Info,
  Link2,
  Plus,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilePreview } from "@/components/ui/FilePreview";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/useToast";
import { useProjectDocumentPreview } from "@/hooks/useProjectDocumentPreview";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { projectDocuments } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { withSignedUrl } from "@/lib/api/projectDocuments";
import { API } from "@/lib/api/routes";
import { downloadFromSignedUrl } from "@/lib/download";
import { fileType, formatFileSize } from "@/lib/fileUtils";
import { relativeTime } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import type { DbProjectDocument } from "@/types";

interface DocumentVersionListProps {
  projectId: string;
  /** Any version row in the group — the list fetches the rest by document id. */
  doc: DbProjectDocument;
  canEdit: boolean;
  onUploadNewVersion: () => void;
  /** Fires when the current version changes (new upload, revert, latest deleted). */
  onLatestChanged: (latest: DbProjectDocument) => void;
}

/**
 * GitHub-style vertical timeline of every row in a document's version group.
 * Newest event at the top, oldest at the bottom. Reverts (new rows that reuse
 * an older row's `storage_path`) get a distinct icon + verb so they don't
 * look like fresh uploads.
 */
export function DocumentVersionList({
  projectId,
  doc,
  canEdit,
  onUploadNewVersion,
  onLatestChanged,
}: DocumentVersionListProps) {
  const { data: versions, mutate } = useSWR<DbProjectDocument[]>(
    API.projectDocumentVersions(projectId, doc.id),
    { revalidateOnFocus: false }
  );
  const [pendingRevert, setPendingRevert] = useState<DbProjectDocument | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<DbProjectDocument | null>(
    null
  );
  const [working, setWorking] = useState(false);
  const [highlightedVersion, setHighlightedVersion] = useState<number | null>(
    null
  );
  const [expandedVersionIds, setExpandedVersionIds] = useState<Set<string>>(
    () => new Set()
  );
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const highlightTimer = useRef<number | null>(null);

  // Clear any pending highlight timeout on unmount so a closed sheet doesn't
  // trigger setState on a dead component.
  useEffect(() => {
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  function toggleExpanded(id: string) {
    setExpandedVersionIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function jumpToVersion(version: number) {
    const row = rowRefs.current.get(version);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    setHighlightedVersion(version);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedVersion(null);
      highlightTimer.current = null;
    }, 1600);
  }

  const isLoading = !versions;
  const versionCount = versions?.length ?? 0;

  const { latestVersion, firstSeen, displayVersions } = useMemo(() => {
    if (!versions) {
      return {
        latestVersion: doc.version,
        firstSeen: null,
        displayVersions: null,
      };
    }
    let latest = 0;
    const seen = new Map<string, number>();
    for (const v of versions) {
      if (v.version > latest) latest = v.version;
      if (!seen.has(v.storage_path)) seen.set(v.storage_path, v.version);
    }
    return {
      latestVersion: latest,
      firstSeen: seen,
      displayVersions: [...versions].reverse(),
    };
  }, [versions, doc.version]);

  // Cascade the timeline rows in when the version set arrives / changes.
  const listRef = useStaggerReveal<HTMLOListElement>(
    (versions ?? []).map((v) => v.id).join(",")
  );

  function isRevert(v: DbProjectDocument): number | null {
    if (!firstSeen) return null;
    const earliest = firstSeen.get(v.storage_path);
    return earliest !== undefined && earliest < v.version ? earliest : null;
  }

  const copyLink = (v: DbProjectDocument) =>
    withSignedUrl(projectId, v.id, "Could not copy link.", async (url) => {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied." });
    });
  const openInNewTab = (v: DbProjectDocument) =>
    withSignedUrl(projectId, v.id, "Could not open.", (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  const downloadVersion = (v: DbProjectDocument) =>
    withSignedUrl(projectId, v.id, "Download failed.", (url) => {
      downloadFromSignedUrl(url, v.file_name);
    });

  async function confirmRevert() {
    if (!pendingRevert) return;
    setWorking(true);
    try {
      const created = await projectDocuments.revertToVersion(
        projectId,
        doc.id,
        pendingRevert.version
      );
      await mutate();
      onLatestChanged(created);
      toast({ title: `Reverted to V${pendingRevert.version}.` });
      setPendingRevert(null);
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Revert failed.",
        variant: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setWorking(true);
    try {
      await projectDocuments.deleteVersion(projectId, doc.id, pendingDelete.id);
      const fresh = await mutate();
      if (
        pendingDelete.version === latestVersion &&
        fresh &&
        fresh.length > 0
      ) {
        const newLatest = fresh.reduce((a, b) =>
          a.version > b.version ? a : b
        );
        onLatestChanged(newLatest);
      }
      toast({ title: `Deleted V${pendingDelete.version}.` });
      setPendingDelete(null);
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Delete failed.",
        variant: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  // Earlier rows may have been hard-deleted, so the new current after a
  // latest-delete isn't necessarily `latestVersion - 1`.
  const newCurrentAfterLatestDelete = useMemo(() => {
    if (!versions || !pendingDelete) return null;
    if (pendingDelete.version !== latestVersion) return null;
    const remaining = versions.filter((v) => v.id !== pendingDelete.id);
    if (remaining.length === 0) return null;
    return remaining.reduce((m, v) => Math.max(m, v.version), 0);
  }, [versions, pendingDelete, latestVersion]);

  const canDeleteVersion = canEdit && versionCount > 1;

  return (
    <section className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-primary">
            Versions
          </span>
          {versions && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-bg-elevated text-text-muted">
              {versionCount}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onUploadNewVersion}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent text-black hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
          >
            <Plus className="w-3 h-3" />
            Upload new version
          </button>
        )}
      </div>

      {isLoading && <VersionListSkeleton />}

      {displayVersions && (
        <ol ref={listRef} className="flex flex-col">
          {displayVersions.map((v, i) => {
            const isLatest = v.version === latestVersion;
            const revertOf = isRevert(v);
            const isLast = i === displayVersions.length - 1;
            const isHighlighted = highlightedVersion === v.version;
            const isExpanded = expandedVersionIds.has(v.id);
            return (
              <li
                key={v.id}
                data-anim-item
                ref={(el) => {
                  if (el) rowRefs.current.set(v.version, el);
                  else rowRefs.current.delete(v.version);
                }}
                className="flex gap-3.5"
              >
                <div className="flex flex-col items-center w-9 shrink-0">
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full border",
                      revertOf !== null
                        ? "bg-info/10 border-info/40 text-info"
                        : isLatest
                          ? "bg-accent/10 border-accent/40 text-accent"
                          : "bg-bg-elevated border-border-default text-text-muted"
                    )}
                  >
                    {revertOf !== null ? (
                      <Undo2 className="w-4 h-4" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </div>
                  {!isLast && (
                    <div className="flex-1 w-px bg-border-default min-h-[56px]" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary truncate max-w-[180px]">
                      {v.uploaded_by_name ?? "Unknown"}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {revertOf !== null
                        ? `reverted to V${revertOf}`
                        : "uploaded"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-500 ease-out",
                        isHighlighted
                          ? "bg-accent/25 border-accent text-accent ring-2 ring-accent/40"
                          : isLatest
                            ? "bg-accent/10 border-accent/40 text-accent"
                            : "bg-bg-elevated border-border-default text-text-muted"
                      )}
                    >
                      {isLatest ? `V${v.version} · latest` : `V${v.version}`}
                    </span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">
                      {relativeTime(v.created_at)}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "mt-2.5 flex items-center justify-between gap-2 rounded-lg border bg-bg-primary px-3 py-2.5 ring-1 ring-transparent transition-all duration-500 ease-out",
                      isHighlighted
                        ? "border-accent/50 bg-accent/15 ring-accent/40"
                        : "border-border-default"
                    )}
                  >
                    <VersionFilePill
                      version={v}
                      isLatest={isLatest}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpanded(v.id)}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadVersion(v)}
                        className="hidden md:inline-flex p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors cursor-pointer"
                        aria-label="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {canEdit && !isLatest && (
                        <button
                          type="button"
                          onClick={() => setPendingRevert(v)}
                          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-text-secondary border border-border-default bg-bg-elevated hover:bg-bg-input transition-colors cursor-pointer"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-info" />
                          Revert
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors data-[state=open]:bg-bg-elevated data-[state=open]:text-text-primary cursor-pointer"
                            aria-label="More"
                          >
                            <Ellipsis className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[200px]"
                        >
                          <DropdownMenuItem onSelect={() => downloadVersion(v)}>
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </DropdownMenuItem>
                          {canEdit && !isLatest && (
                            <DropdownMenuItem
                              className="md:hidden"
                              onSelect={() => setPendingRevert(v)}
                            >
                              <Undo2 className="w-3.5 h-3.5 text-info" />
                              Revert to this version
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => openInNewTab(v)}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open in new tab
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyLink(v)}>
                            <Link2 className="w-3.5 h-3.5" />
                            Share (copy link)
                          </DropdownMenuItem>
                          {canDeleteVersion && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={() => setPendingDelete(v)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete this version
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {!isLatest && (
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-out",
                        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden">
                        {isExpanded && (
                          <VersionDetailPanel
                            projectId={projectId}
                            version={v}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {revertOf !== null && (
                    <button
                      type="button"
                      onClick={() => jumpToVersion(revertOf)}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-info bg-info/5 border border-info/30 hover:bg-info/10 cursor-pointer transition-colors"
                    >
                      <Info className="w-3 h-3" />
                      Copy of V{revertOf} — new entry in the log.
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={!!pendingRevert}
        onOpenChange={(v) => !v && setPendingRevert(null)}
        title={
          pendingRevert ? `Revert to V${pendingRevert.version}?` : "Revert"
        }
        description={
          pendingRevert ? (
            <span>
              A new version will be created at V{latestVersion + 1} with{" "}
              <strong className="text-text-primary">
                V{pendingRevert.version}
              </strong>
              &apos;s file. Nothing in the history is lost.
            </span>
          ) : null
        }
        confirmLabel="Revert"
        submitting={working}
        onConfirm={confirmRevert}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={
          pendingDelete ? `Delete V${pendingDelete.version}?` : "Delete version"
        }
        description={
          pendingDelete && newCurrentAfterLatestDelete !== null ? (
            <span>
              Deleting V{pendingDelete.version} will make V
              {newCurrentAfterLatestDelete} the current version. The row will be
              permanently removed from the history.
            </span>
          ) : pendingDelete ? (
            <span>
              V{pendingDelete.version} will be permanently removed from the
              history. The current version is unaffected.
            </span>
          ) : null
        }
        confirmLabel="Delete"
        destructive
        submitting={working}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function VersionFilePill({
  version,
  isLatest,
  isExpanded,
  onToggle,
}: {
  version: DbProjectDocument;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-error/10 shrink-0">
        <FileText className="w-4 h-4 text-error" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 text-left">
        <p className="text-sm font-semibold text-text-primary truncate">
          {version.file_name}
        </p>
        <p className="text-xs text-text-muted">
          {fileType(version.file_name)} · {formatFileSize(version.file_size)}
        </p>
      </div>
      {!isLatest && (
        <ChevronDown
          className={cn(
            "w-4 h-4 text-text-muted shrink-0 ml-1 mr-2 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      )}
    </>
  );
  if (isLatest) {
    return <div className="flex items-center gap-3 min-w-0">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      className="flex items-center gap-3 min-w-0 rounded-md hover:bg-bg-elevated/40 -mx-1 px-1 -my-0.5 py-0.5 transition-colors cursor-pointer text-left"
    >
      {inner}
    </button>
  );
}

function VersionListSkeleton() {
  return (
    <ol className="flex flex-col" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3.5">
          <div className="flex flex-col items-center w-9 shrink-0">
            <Skeleton className="w-9 h-9 rounded-full" />
            {i < 2 && (
              <div className="flex-1 w-px bg-border-default min-h-[56px]" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-10 rounded-full" />
            </div>
            <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-border-default bg-bg-primary px-3 py-2.5">
              <Skeleton className="w-9 h-9 shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function VersionDetailPanel({
  projectId,
  version,
}: {
  projectId: string;
  version: DbProjectDocument;
}) {
  const { previewable, previewUrl, refreshUrl } = useProjectDocumentPreview(
    projectId,
    version
  );
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-border-default bg-bg-elevated/30 p-3">
      {previewable && (
        <FilePreview
          url={previewUrl}
          fileName={version.file_name}
          mimeType={version.mime_type}
          maxHeight={220}
          refreshUrl={refreshUrl}
        />
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-text-muted">
          Description
        </span>
        {version.description ? (
          <p className="text-xs text-text-primary whitespace-pre-wrap">
            {version.description}
          </p>
        ) : (
          <p className="text-xs italic text-text-muted">No description.</p>
        )}
      </div>
    </div>
  );
}
