"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Search,
  ArrowUpDown,
  Upload,
  FolderOpen,
  UploadCloud,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { API } from "@/lib/api/routes";
import { projectDocuments } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";
import { SectionSidebar } from "./_components/SectionSidebar";
import { DocumentRow } from "./_components/DocumentRow";
import { NewSectionDialog } from "./_components/NewSectionDialog";
import { RenameSectionDialog } from "./_components/RenameSectionDialog";
import { UploadDocumentDialog } from "./_components/UploadDocumentDialog";
import { relativeTime } from "@/lib/formatTime";

type SortMode = "recent" | "name" | "size";

/** Per-project Documents page — sidebar of sections + main pane of doc rows. */
export default function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { mutate } = useSWRConfig();
  const { role } = useUserRole();
  const canEdit = role === "pm" || role === "architect";

  const sectionsKey = API.projectDocumentSections(projectId);
  const { data: sections, isLoading: sectionsLoading } =
    useSWR<DbProjectDocumentSection[]>(sectionsKey);

  // null = the "All documents" pseudo-section; string = a real section id.
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  // Bumped on every drop so the upload dialog remount key still changes
  // when the user drops the same file twice in a row.
  const [dropCount, setDropCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DbProjectDocument | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [sectionToRename, setSectionToRename] =
    useState<DbProjectDocumentSection | null>(null);
  const [sectionToDelete, setSectionToDelete] =
    useState<DbProjectDocumentSection | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  // dragenter/leave fire on every child border crossing, so a counter is the
  // simplest reliable way to know "is a drag still hovering my zone".
  const dragCounter = useRef(0);

  // Window-level fallback: a drop outside <main> doesn't fire our handlers,
  // so we'd never clear `dragOver`. preventDefault on dragover also stops
  // the browser from opening files dropped anywhere on the page.
  useEffect(() => {
    function clear() {
      dragCounter.current = 0;
      setDragOver(false);
    }
    function onWindowDrop(e: DragEvent) {
      e.preventDefault();
      clear();
    }
    function onWindowDragLeave(e: DragEvent) {
      if (e.relatedTarget == null) clear();
    }
    function onWindowDragOver(e: DragEvent) {
      e.preventDefault();
    }
    window.addEventListener("drop", onWindowDrop);
    window.addEventListener("dragend", clear);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("dragover", onWindowDragOver);
    return () => {
      window.removeEventListener("drop", onWindowDrop);
      window.removeEventListener("dragend", clear);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("dragover", onWindowDragOver);
    };
  }, []);

  const activeSection = useMemo(
    () =>
      activeSectionId
        ? (sections?.find((s) => s.id === activeSectionId) ?? null)
        : null,
    [sections, activeSectionId]
  );

  const docsKey = activeSectionId
    ? API.projectDocuments(projectId, activeSectionId)
    : API.projectDocumentsAll(projectId);
  const { data: docs, isLoading: docsLoading } =
    useSWR<DbProjectDocument[]>(docsKey);

  const sortedDocs = useMemo(() => {
    if (!docs) return null;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? docs.filter((d) => d.file_name.toLowerCase().includes(q))
      : docs;
    const copy = [...filtered];
    switch (sort) {
      case "name":
        copy.sort((a, b) => a.file_name.localeCompare(b.file_name));
        break;
      case "size":
        copy.sort((a, b) => b.file_size - a.file_size);
        break;
      case "recent":
      default:
        copy.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
    return copy;
  }, [docs, search, sort]);

  // Defensive max-scan: server currently sorts DESC, but we don't want a
  // future ORDER BY tweak to silently break the "Updated …" label.
  const lastUpdated = useMemo(() => {
    if (!docs || docs.length === 0) return null;
    let latestMs = 0;
    for (const d of docs) {
      const ms = new Date(d.created_at).getTime();
      if (ms > latestMs) latestMs = ms;
    }
    return latestMs > 0 ? relativeTime(new Date(latestMs).toISOString()) : null;
  }, [docs]);

  async function handleCreateSection(data: { name: string; icon: string }) {
    try {
      const created = await projectDocuments.createSection(projectId, data);
      await mutate(sectionsKey);
      setActiveSectionId(created.id);
      setNewSectionOpen(false);
      toast({ title: `Section "${data.name}" created.` });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not create section.",
        variant: "error",
      });
    }
  }

  async function handleRenameSection(data: { name: string; icon: string }) {
    if (!sectionToRename) return;
    try {
      await projectDocuments.updateSection(projectId, sectionToRename.id, data);
      await mutate(sectionsKey);
      setSectionToRename(null);
      toast({ title: "Section updated." });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not rename section.",
        variant: "error",
      });
    }
  }

  async function handleMoveSection(
    section: DbProjectDocumentSection,
    direction: "up" | "down"
  ) {
    if (!sections) return;
    const sorted = [...sections].sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at)
    );
    const idx = sorted.findIndex((s) => s.id === section.id);
    if (idx === -1) return;
    const otherIdx = direction === "up" ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= sorted.length) return;
    const other = sorted[otherIdx];
    try {
      // Swap positions in parallel. If one fails we may end up with both
      // sections briefly sharing a position; the next list fetch sorts it
      // out via the `created_at` tiebreaker.
      await Promise.all([
        projectDocuments.updateSection(projectId, section.id, {
          position: other.position,
        }),
        projectDocuments.updateSection(projectId, other.id, {
          position: section.position,
        }),
      ]);
      await mutate(sectionsKey);
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Could not reorder.",
        variant: "error",
      });
    }
  }

  async function performSectionDelete(section: DbProjectDocumentSection) {
    try {
      await projectDocuments.deleteSection(projectId, section.id);
      // If we were viewing this section, fall back to "All documents".
      if (activeSectionId === section.id) setActiveSectionId(null);
      await Promise.all([
        mutate(sectionsKey),
        mutate(API.projectDocumentsAll(projectId)),
      ]);
      toast({ title: `Deleted "${section.name}".` });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not delete section.",
        variant: "error",
      });
    }
  }

  async function handleDownload(doc: DbProjectDocument) {
    try {
      const { url } = await projectDocuments.getDownloadUrl(projectId, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Download failed.",
        variant: "error",
      });
    }
  }

  async function performDelete(doc: DbProjectDocument) {
    try {
      await projectDocuments.deleteDocument(projectId, doc.id);
      await Promise.all([
        mutate(API.projectDocumentsAll(projectId)),
        mutate(API.projectDocuments(projectId, doc.section_id)),
        mutate(sectionsKey),
      ]);
      toast({ title: "Document deleted." });
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Delete failed.",
        variant: "error",
      });
    }
  }

  if (sectionsLoading) {
    return (
      <div className="flex flex-1 bg-bg-secondary">
        <div className="w-[280px] border-r border-border-default bg-bg-primary p-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="flex-1 p-6 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  const canDrop = canEdit && !!activeSection;
  const clearDrag = () => {
    dragCounter.current = 0;
    setDragOver(false);
  };

  function handleDragEnter(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = canDrop ? "copy" : "none";
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    clearDrag();
    if (!canDrop) {
      toast({
        title: "Pick a section first to upload.",
        variant: "error",
      });
      return;
    }
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setDroppedFile(dropped);
    setDropCount((c) => c + 1);
    setUploadOpen(true);
  }

  return (
    <div className="flex flex-1 bg-bg-secondary">
      <SectionSidebar
        sections={sections ?? []}
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
        onCreate={() => setNewSectionOpen(true)}
        onRename={setSectionToRename}
        onDelete={setSectionToDelete}
        onMove={handleMoveSection}
        canEdit={canEdit}
      />

      <main
        className="relative flex-1 flex flex-col min-w-0"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div
            className={`pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed backdrop-blur-sm ${
              canDrop
                ? "border-accent bg-accent/10"
                : "border-error bg-error/10"
            }`}
          >
            <UploadCloud
              className={`w-10 h-10 ${canDrop ? "text-accent" : "text-error"}`}
            />
            <p
              className={`text-sm font-semibold ${
                canDrop ? "text-text-primary" : "text-error"
              }`}
            >
              {canDrop
                ? `Drop to upload to ${activeSection?.name}`
                : "Pick a section first to upload"}
            </p>
          </div>
        )}
        <header className="flex items-center justify-between gap-4 px-7 pt-6 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">
              {activeSection ? activeSection.name : "All documents"}
            </h1>
            <p className="text-[13px] text-text-muted">
              {docs?.length ?? 0} document{docs?.length === 1 ? "" : "s"}
              {lastUpdated && (
                <>
                  <span className="mx-1.5">·</span>
                  Updated {lastUpdated}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted z-10" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents"
                className="pl-9 h-9"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setSort((s) =>
                  s === "recent" ? "name" : s === "name" ? "size" : "recent"
                )
              }
              className="flex items-center gap-2 px-3 h-9 bg-bg-primary border border-border-default rounded-md text-[13px] font-medium text-text-secondary hover:bg-bg-elevated transition-colors"
              title="Cycle sort"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
              {sort === "recent" ? "Recent" : sort === "name" ? "Name" : "Size"}
            </button>
            {canEdit && activeSection && (
              <Button onClick={() => setUploadOpen(true)} size="sm">
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 px-7 pb-8 flex flex-col gap-3">
          {docsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
            ))
          ) : !sortedDocs || sortedDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <FolderOpen className="w-10 h-10 text-text-muted/50" />
              <p className="text-sm font-medium text-text-secondary">
                {search
                  ? "No documents match your search."
                  : "No documents yet."}
              </p>
              {!search && canEdit && activeSection && (
                <Button
                  onClick={() => setUploadOpen(true)}
                  size="sm"
                  variant="secondary"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload first document
                </Button>
              )}
            </div>
          ) : (
            sortedDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDownload={() => handleDownload(doc)}
                onDelete={() => setDocToDelete(doc)}
                canEdit={canEdit}
                showSectionBadge={!activeSection}
              />
            ))
          )}
        </div>
      </main>

      <NewSectionDialog
        open={newSectionOpen}
        onOpenChange={setNewSectionOpen}
        onSubmit={handleCreateSection}
      />
      {activeSection && (
        <UploadDocumentDialog
          // Remount on each drop so `initialFile` seeds via useState init —
          // avoids a mirror-prop useEffect and stale state on consecutive drops.
          // `dropCount` makes the key change even when the same file is
          // dropped twice in a row.
          key={droppedFile ? `drop-${dropCount}` : "manual"}
          open={uploadOpen}
          onOpenChange={(v) => {
            setUploadOpen(v);
            if (!v) setDroppedFile(null);
          }}
          projectId={projectId}
          sectionId={activeSection.id}
          sectionName={activeSection.name}
          initialFile={droppedFile}
          onSuccess={() =>
            Promise.all([
              mutate(API.projectDocuments(projectId, activeSection.id)),
              mutate(API.projectDocumentsAll(projectId)),
              mutate(sectionsKey),
            ])
          }
        />
      )}
      <ConfirmDialog
        open={!!docToDelete}
        onOpenChange={(v) => !v && setDocToDelete(null)}
        title="Delete document"
        description={
          docToDelete && (
            <>
              Delete <strong>{docToDelete.file_name}</strong>? This cannot be
              undone.
            </>
          )
        }
        confirmLabel="Delete"
        destructive
        submitting={deleting}
        onConfirm={async () => {
          if (!docToDelete) return;
          setDeleting(true);
          try {
            await performDelete(docToDelete);
          } finally {
            setDeleting(false);
            setDocToDelete(null);
          }
        }}
      />
      {sectionToRename && (
        <RenameSectionDialog
          // Re-mount per target so the inputs seed fresh on each open.
          key={sectionToRename.id}
          open
          initialName={sectionToRename.name}
          initialIcon={sectionToRename.icon}
          onOpenChange={(v) => !v && setSectionToRename(null)}
          onSubmit={handleRenameSection}
        />
      )}
      <ConfirmDialog
        open={!!sectionToDelete}
        onOpenChange={(v) => !v && setSectionToDelete(null)}
        title="Delete section"
        description={
          sectionToDelete && (
            <>
              Delete the <strong>{sectionToDelete.name}</strong> section
              {sectionToDelete.doc_count > 0 ? (
                <>
                  {" "}
                  and its <strong>{sectionToDelete.doc_count}</strong> document
                  {sectionToDelete.doc_count === 1 ? "" : "s"}
                </>
              ) : null}
              ? This cannot be undone.
            </>
          )
        }
        confirmLabel={
          sectionToDelete && sectionToDelete.doc_count > 0
            ? `Delete section and ${sectionToDelete.doc_count} file${sectionToDelete.doc_count === 1 ? "" : "s"}`
            : "Delete section"
        }
        destructive
        submitting={deletingSection}
        onConfirm={async () => {
          if (!sectionToDelete) return;
          setDeletingSection(true);
          try {
            await performSectionDelete(sectionToDelete);
          } finally {
            setDeletingSection(false);
            setSectionToDelete(null);
          }
        }}
      />
    </div>
  );
}
