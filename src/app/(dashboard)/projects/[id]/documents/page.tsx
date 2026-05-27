"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  ArrowUpDown,
  FolderOpen,
  Search,
  Upload,
  UploadCloud,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DocumentDetailSheet } from "./_components/DocumentDetailSheet";
import { DocumentBulkActions } from "./_components/DocumentBulkActions";
import { runSettledWithConcurrency } from "@/lib/concurrency";
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
  // auto-animate ref for the doc list — smooth add / remove / reorder when
  // the search filter changes or rows arrive after upload.
  const [docListRef] = useAutoAnimate<HTMLDivElement>();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  // Token paired with `droppedFiles` so the upload dialog remounts on each
  // drop even if the same files are dropped twice in a row. `null` means
  // "no drop, use the manual click flow" — the dialog uses a stable key
  // for that branch.
  const [dropToken, setDropToken] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DbProjectDocument | null>(
    null
  );
  // Single state for "which doc is open and how" — merging avoids a flicker
  // where opening a doc via Edit briefly renders the sheet in view mode
  // because `openDocEdit` lagged a render behind `openDoc`.
  const [openDoc, setOpenDoc] = useState<{
    doc: DbProjectDocument;
    edit: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);
  const hasSelection = selectedIds.size > 0;
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

  // Selection follows the visible-doc set. Switching sections / typing in
  // search shouldn't leave a phantom "N selected" badge active for docs that
  // are no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeSectionId]);

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
    // Match against filename + description so users can find docs by either.
    const filtered = q
      ? docs.filter(
          (d) =>
            d.file_name.toLowerCase().includes(q) ||
            (d.description?.toLowerCase().includes(q) ?? false)
        )
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

  /**
   * Create a section, revalidate the SWR cache, toast on success.
   * Returns the new row so callers can wire it into their own UI (e.g. the
   * upload dialog's section picker auto-selects it). Errors bubble.
   */
  async function createSection(data: {
    name: string;
    icon: string;
  }): Promise<DbProjectDocumentSection> {
    const created = await projectDocuments.createSection(projectId, data);
    await mutate(sectionsKey);
    toast({ title: `Section "${data.name}" created.` });
    return created;
  }

  async function handleCreateSection(data: { name: string; icon: string }) {
    try {
      const created = await createSection(data);
      setActiveSectionId(created.id);
      setNewSectionOpen(false);
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

  async function handleReorderSections(orderedIds: string[]) {
    if (!sections) return;
    const byId = new Map(sections.map((s) => [s.id, s]));
    // Only PATCH sections whose new index differs from the stored position —
    // a 5-section drop usually moves 2-3 of them, not all 5.
    const changed = orderedIds
      .map((id, newPosition) => ({ section: byId.get(id), newPosition }))
      .filter(
        (e): e is { section: DbProjectDocumentSection; newPosition: number } =>
          !!e.section && e.section.position !== e.newPosition
      );
    if (changed.length === 0) return;

    // Optimistic update — SWR cache flips to the new order before the network
    // round-trip lands so the sidebar doesn't snap back during the request.
    const optimistic = orderedIds.map((id, position) => {
      const existing = byId.get(id);
      if (!existing) throw new Error(`Section ${id} not in cache`);
      return { ...existing, position };
    });
    void mutate(sectionsKey, optimistic, { revalidate: false });

    try {
      await Promise.all(
        changed.map((e) =>
          projectDocuments.updateSection(projectId, e.section.id, {
            position: e.newPosition,
          })
        )
      );
      await mutate(sectionsKey);
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Could not reorder.",
        variant: "error",
      });
      // Roll back the optimistic write by forcing a refetch.
      await mutate(sectionsKey);
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

  async function moveDocument(doc: DbProjectDocument, targetSectionId: string) {
    try {
      const updated = await projectDocuments.updateDocument(projectId, doc.id, {
        sectionId: targetSectionId,
      });
      await invalidateDocCaches([doc.section_id, targetSectionId]);
      const target = sections?.find((s) => s.id === targetSectionId);
      toast({
        title: target ? `Moved to "${target.name}".` : "Moved.",
      });
      if (openDoc?.doc.id === updated.id)
        setOpenDoc({ doc: updated, edit: openDoc.edit });
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Move failed.",
        variant: "error",
      });
    }
  }

  async function performDelete(doc: DbProjectDocument) {
    try {
      await projectDocuments.deleteDocument(projectId, doc.id);
      await invalidateDocCaches([doc.section_id]);
      toast({ title: "Document deleted." });
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Delete failed.",
        variant: "error",
      });
    }
  }

  // Hard cap on bulk-select size — prevents a "Select All" on a 500-doc
  // section from firing 500 sequential PATCH/DELETE requests at concurrency
  // 5. Adjust upward once a server-side bulk endpoint exists.
  const BULK_SELECTION_LIMIT = 100;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= BULK_SELECTION_LIMIT) {
          toast({
            title: `Selection limited to ${BULK_SELECTION_LIMIT} documents.`,
            variant: "warning",
          });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  /**
   * Invalidate the documents-related SWR keys for the given sections plus
   * the always-affected All-view and sections-with-counts keys. Used by
   * single-doc moves, bulk operations, and upload success — they all need
   * the same shape of cache fan-out.
   */
  function invalidateDocCaches(sectionIds: Iterable<string>) {
    const keys = new Set<string>([
      API.projectDocumentsAll(projectId),
      sectionsKey,
      ...Array.from(sectionIds).map((sid) =>
        API.projectDocuments(projectId, sid)
      ),
    ]);
    return Promise.all([...keys].map((k) => mutate(k)));
  }

  /**
   * Shared scaffolding for bulk-move / bulk-delete: snapshots the selection,
   * runs the per-doc action concurrently, invalidates caches, clears the
   * selection, and toasts the outcome. Concurrency is bounded to keep the
   * browser from opening N simultaneous requests.
   */
  async function runBulkAction(opts: {
    action: (doc: DbProjectDocument) => Promise<unknown>;
    extraSectionIds?: string[];
    successCopy: (n: number) => string;
    failCopy: (n: number) => string;
  }) {
    if (selectedIds.size === 0 || bulkActing) return { ok: 0, fail: 0 };
    const docs = (sortedDocs ?? []).filter((d) => selectedIds.has(d.id));
    setBulkActing(true);
    const sourceSections = docs.map((d) => d.section_id);
    const results = await runSettledWithConcurrency(docs.length, 5, (i) =>
      opts.action(docs[i])
    );
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    await invalidateDocCaches([
      ...sourceSections,
      ...(opts.extraSectionIds ?? []),
    ]);
    setBulkActing(false);
    clearSelection();
    if (okCount > 0) toast({ title: opts.successCopy(okCount) });
    if (failCount > 0)
      toast({ title: opts.failCopy(failCount), variant: "error" });
    return { ok: okCount, fail: failCount };
  }

  async function performBulkMove(targetSectionId: string) {
    const target = sections?.find((s) => s.id === targetSectionId);
    await runBulkAction({
      action: (doc) =>
        projectDocuments.updateDocument(projectId, doc.id, {
          sectionId: targetSectionId,
        }),
      extraSectionIds: [targetSectionId],
      successCopy: (n) =>
        target ? `Moved ${n} to "${target.name}".` : `Moved ${n} documents.`,
      failCopy: (n) => `${n} file${n === 1 ? "" : "s"} couldn't be moved.`,
    });
  }

  async function performBulkDelete() {
    await runBulkAction({
      action: (doc) => projectDocuments.deleteDocument(projectId, doc.id),
      successCopy: (n) =>
        n === 1 ? "Document deleted." : `Deleted ${n} documents.`,
      failCopy: (n) => `${n} file${n === 1 ? "" : "s"} couldn't be deleted.`,
    });
    setBulkDeleteOpen(false);
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

  const canDrop = canEdit;
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
    if (!canDrop) return;
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length === 0) return;
    setDroppedFiles(dropped);
    setDropToken(crypto.randomUUID());
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
        onReorder={(orderedIds) => void handleReorderSections(orderedIds)}
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
                ? activeSection
                  ? `Drop to upload to ${activeSection.name}`
                  : "Drop to upload"
                : "You don't have permission to upload."}
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
          {hasSelection ? (
            // Toolbar morph — replaces search + sort + Upload with selection
            // controls + bulk actions until the user clears the selection.
            <div className="flex items-center gap-3 shrink-0">
              {(() => {
                const visibleIds = (sortedDocs ?? []).map((d) => d.id);
                const allSelected =
                  visibleIds.length > 0 &&
                  visibleIds.every((id) => selectedIds.has(id));
                const someSelected = !allSelected && selectedIds.size > 0;
                const handleToggleAll = () => {
                  if (allSelected) {
                    setSelectedIds(new Set());
                    return;
                  }
                  if (visibleIds.length > BULK_SELECTION_LIMIT) {
                    toast({
                      title: `Selection limited to ${BULK_SELECTION_LIMIT} documents.`,
                      variant: "warning",
                    });
                    setSelectedIds(
                      new Set(visibleIds.slice(0, BULK_SELECTION_LIMIT))
                    );
                    return;
                  }
                  setSelectedIds(new Set(visibleIds));
                };
                return (
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    aria-label="Select all documents"
                    onCheckedChange={handleToggleAll}
                  />
                );
              })()}
              <span className="text-[13px] font-semibold text-accent">
                {selectedIds.size} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Clear
              </button>
              <DocumentBulkActions
                sections={(sections ?? []).filter(
                  (s) => s.id !== activeSectionId
                )}
                onMove={(sectionId) => void performBulkMove(sectionId)}
                onDelete={() => setBulkDeleteOpen(true)}
              />
            </div>
          ) : (
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
                className="flex items-center gap-2 px-3 h-9 bg-bg-primary border border-border-default rounded-md text-[13px] font-medium text-text-secondary hover:bg-bg-elevated transition-colors cursor-pointer"
                title="Cycle sort"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                {sort === "recent"
                  ? "Recent"
                  : sort === "name"
                    ? "Name"
                    : "Size"}
              </button>
              {canEdit && (
                <Button onClick={() => setUploadOpen(true)} size="sm">
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </Button>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 px-7 pb-8 flex flex-col gap-3">
          {docsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
            ))
          ) : !sortedDocs || sortedDocs.length === 0 ? (
            // Big drop card for an empty real section (gives the drop target a
            // visual identity that hovering files can land on); narrow fallback
            // for the "All documents" view (no section to upload into directly)
            // and for empty search results.
            search || !activeSection || !canEdit ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <FolderOpen className="w-10 h-10 text-text-muted/50" />
                <p className="text-sm font-medium text-text-secondary">
                  {search
                    ? "No documents match your search."
                    : "No documents yet."}
                </p>
                {!search && !activeSection && canEdit && (
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
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="group flex flex-col items-center justify-center gap-3 py-20 border-2 border-dashed border-border-default rounded-xl bg-bg-primary hover:border-accent/60 hover:bg-bg-elevated/40 transition-colors cursor-pointer text-center"
              >
                <UploadCloud className="w-12 h-12 text-text-muted group-hover:text-accent transition-colors" />
                <div className="flex flex-col gap-1">
                  <p className="text-base font-semibold text-text-primary">
                    Drop files here or click to upload
                  </p>
                  <p className="text-xs text-text-muted">
                    Drag in from your desktop, or browse to add files to{" "}
                    <span className="text-text-secondary">
                      {activeSection.name}
                    </span>
                    .
                  </p>
                </div>
              </button>
            )
          ) : (
            <div ref={docListRef} className="flex flex-col gap-3">
              {sortedDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  sections={sections ?? []}
                  onOpen={() => setOpenDoc({ doc, edit: false })}
                  onEdit={() => setOpenDoc({ doc, edit: true })}
                  onMove={(sectionId) => void moveDocument(doc, sectionId)}
                  onDownload={() => handleDownload(doc)}
                  onDelete={() => setDocToDelete(doc)}
                  canEdit={canEdit}
                  showSectionBadge={!activeSection}
                  searchQuery={search}
                  isSelected={selectedIds.has(doc.id)}
                  hasSelection={hasSelection}
                  onToggleSelect={() => toggleSelect(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <NewSectionDialog
        open={newSectionOpen}
        onOpenChange={setNewSectionOpen}
        onSubmit={handleCreateSection}
      />
      <UploadDocumentDialog
        // Remount on each drop so `initialFiles` seed via useState init —
        // avoids a mirror-prop useEffect and stale state on consecutive
        // drops. A fresh `dropToken` per drop guarantees a key change even
        // when the same files are dropped twice in a row.
        key={dropToken ?? "manual"}
        open={uploadOpen}
        onOpenChange={(v) => {
          setUploadOpen(v);
          if (!v) {
            setDroppedFiles([]);
            setDropToken(null);
          }
        }}
        projectId={projectId}
        sections={sections ?? []}
        initialSectionId={activeSectionId}
        initialFiles={droppedFiles}
        onCreateSection={createSection}
        onSuccess={(created) => {
          if (created.length === 0) return;
          // Every doc in a single batch lands in the same section (v1 has no
          // per-file section override) — derive the destination from the
          // first created row.
          void invalidateDocCaches([created[0].section_id]);
        }}
      />
      <DocumentDetailSheet
        // Remount per doc id so the sheet's lazy-init useState picks up the
        // fresh doc's fields (no mirror useEffect — see DocumentDetailSheet).
        key={openDoc?.doc.id ?? "closed"}
        projectId={projectId}
        doc={openDoc?.doc ?? null}
        startInEditMode={openDoc?.edit}
        sections={sections ?? []}
        canEdit={canEdit}
        onOpenChange={(v) => {
          if (!v) setOpenDoc(null);
        }}
        onUpdated={(updated) => {
          // Section change → invalidate both the old and new section's
          // listings; otherwise just the destination + always-affected keys.
          const prev = openDoc?.doc;
          const touched =
            prev && prev.section_id !== updated.section_id
              ? [prev.section_id, updated.section_id]
              : [updated.section_id];
          void invalidateDocCaches(touched);
          setOpenDoc({ doc: updated, edit: openDoc?.edit ?? false });
        }}
        onCreateSection={createSection}
        onDeleteRequest={(doc) => {
          setOpenDoc(null);
          setDocToDelete(doc);
        }}
      />
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
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(v) => !v && setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} document${selectedIds.size === 1 ? "" : "s"}`}
        description={
          <>
            Delete <strong>{selectedIds.size}</strong> document
            {selectedIds.size === 1 ? "" : "s"}? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        submitting={bulkActing}
        onConfirm={performBulkDelete}
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
