"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { BoqTabSkeleton } from "../boq/_components/BoqTabSkeleton";
import { useBoq } from "@/hooks/useBoq";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { useUserRole } from "@/hooks/useUserRole";
import { isExternalViewer } from "@/lib/roles";
import { BoqCreateDialog } from "../boq/_components/BoqCreateDialog";
import { BoqHeader } from "../boq/_components/BoqHeader";
import { BoqSummaryCards } from "../boq/_components/BoqSummaryCards";
import { BoqTable } from "../boq/_components/BoqTable";
import { BoqApplyRateDialog } from "../boq/_components/BoqApplyRateDialog";
import { BoqBottomBar } from "../boq/_components/BoqBottomBar";
import { BoqActionBar } from "../boq/_components/BoqActionBar";
import { BoqSourceFilter } from "../boq/_components/BoqSourceFilter";
import { useBoqSourceFilter } from "../boq/_hooks/useBoqSourceFilter";
import { BoqCreateSectionDialog } from "../boq/_components/BoqCreateSectionDialog";
import { BoqCreateItemSheet } from "../boq/_components/BoqCreateItemSheet";
import { BoqElementPickerDialog } from "../boq/_components/BoqElementPickerDialog";
import { BoqRenameSectionDialog } from "../boq/_components/BoqRenameSectionDialog";
import { BoqDeleteSectionDialog } from "../boq/_components/BoqDeleteSectionDialog";
import { BoqBulkActionBar } from "../boq/_components/BoqBulkActionBar";
import { useBoqSelection } from "@/hooks/useBoqSelection";
import { BoqItemDrawer } from "../boq/_components/BoqItemDrawer";
import { SHEET_TRANSITION_MS } from "@/components/ui/sheet";
import { BoqImportDialog } from "../boq/_components/BoqImportDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { boq as boqApi, ApiError } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { saveBlob } from "@/lib/download";
import type { BoqItemWithComputed, BoqSection } from "@/types";
import {
  BOQ_ITEM_PHASES,
  BOQ_ITEM_PHASE_TRANSITIONS,
  type BoqItemPhase,
} from "@/lib/validations";
import { canFireBoqPhaseTransition } from "@/lib/boq/phasePermissions";
import { BoqBulkLifecyclePreviewDialog } from "../boq/_components/BoqBulkLifecyclePreviewDialog";
import type { BulkLifecyclePlanEntry } from "../boq/_lib/bulkLifecyclePlanner";

interface BoqTabProps {
  projectId: string;
  projectName: string;
}

/** Project tab that orchestrates the BOQ feature: empty state, table, dialogs, and item drawer. */
export function BoqTab({ projectId, projectName }: BoqTabProps) {
  const {
    boq,
    notFound,
    isLoading,
    error,
    mutate: mutateBoq,
  } = useBoq(projectId);
  const { role, session } = useUserRole();
  const currentUserId = session?.user?.id ?? null;
  const {
    updateItem,
    setItemExcluded,
    moveItem,
    bulkMoveItems,
    bulkDeleteItems,
    bulkSetItemPhase,
    setItemPhase,
    deleteItem,
    updateSection,
    deleteSection,
    reorderSections,
  } = useBoqMutations(projectId);

  const [createBoqOpen, setCreateBoqOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createItemSection, setCreateItemSection] = useState<string | null>(
    null
  );
  // Insert-between: the anchor row + side the create sheet inserts relative to.
  const [insertAnchor, setInsertAnchor] = useState<{
    itemId: string;
    position: "above" | "below";
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInitialSection, setPickerInitialSection] = useState<
    string | null
  >(null);
  const [renameSection, setRenameSection] = useState<BoqSection | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] =
    useState<BoqSection | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] =
    useState<BoqItemWithComputed | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  // RFQ-3d: a delete request for an item on a live RFQ opens this "remove from
  // scope instead" prompt on the first click, rather than a failing delete.
  const [rfqBlockedItem, setRfqBlockedItem] =
    useState<BoqItemWithComputed | null>(null);
  const [excludingBlocked, setExcludingBlocked] = useState(false);
  // RFQ-3d: route a delete request — an item on a live RFQ can't be deleted, so
  // prompt to remove it from scope instead of letting the delete fail. Stable
  // (only touches state setters) + async to match the `onDeleteItem` prop type,
  // so passing it down doesn't defeat BoqItemRow's memo. Declared with the other
  // hooks (before any early return) to satisfy rules-of-hooks.
  const requestDeleteItem = useCallback(async (item: BoqItemWithComputed) => {
    if (item.on_rfq) setRfqBlockedItem(item);
    else setDeleteItemTarget(item);
  }, []);
  const [applyRateTarget, setApplyRateTarget] =
    useState<BoqItemWithComputed | null>(null);
  const [drawerItem, setDrawerItem] = useState<BoqItemWithComputed | null>(
    null
  );
  // Tracks the slide-close-then-reopen swap when the user clicks an item in
  // the bulk-batch popover. Cleared on unmount so the deferred `setState`
  // never fires on an unmounted component.
  const drawerSwapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (drawerSwapTimer.current) clearTimeout(drawerSwapTimer.current);
    },
    []
  );
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { selected: sourceFilter, setSelected: setSourceFilter } =
    useBoqSourceFilter();

  // Drives the row-level "+ Create new section and move here" flow.
  // When non-null, the create-section dialog is open and the item is the
  // pending target — on success we move it into the freshly-created section.
  const [createAndMoveTarget, setCreateAndMoveTarget] =
    useState<BoqItemWithComputed | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<BoqItemPhase>("draft");
  // Drives the spinner / disabled state on the floating bulk action bar.
  // Without it, fast bulk requests look like ~1s of "nothing happening".
  const [bulkPending, setBulkPending] = useState(false);
  const withBulkPending = useCallback(async (run: () => Promise<void>) => {
    setBulkPending(true);
    try {
      await run();
    } finally {
      setBulkPending(false);
    }
  }, []);

  // Selection mode (PR 2). Disabled when the BOQ is locked.
  const allItemIds = useMemo(
    () => (boq ? boq.items.map((it) => it.id) : []),
    [boq]
  );
  const itemIdsBySection = useMemo(() => {
    const map = new Map<string | null, string[]>();
    if (boq) {
      for (const it of boq.items) {
        const key = it.section_id ?? null;
        const list = map.get(key) ?? [];
        list.push(it.id);
        map.set(key, list);
      }
    }
    return map;
  }, [boq]);
  const selection = useBoqSelection({ allItemIds, itemIdsBySection });

  // When every selected item shares a field value, surface it so downstream
  // popovers can disable the matching row. Mixed selection → undefined. Used
  // for both the section move-target and the phase picker.
  const sharedSelectedSectionId = useMemo(
    () =>
      sharedFieldAcrossSelection(
        boq?.items,
        selection.selected,
        (it) => it.section_id ?? null
      ),
    [boq?.items, selection.selected]
  );
  const sharedSelectedPhase = useMemo(
    () =>
      sharedFieldAcrossSelection(
        boq?.items,
        selection.selected,
        (it) => it.phase
      ),
    [boq?.items, selection.selected]
  );

  // Resolved only while the preview is open — keeps the filter off the hot
  // render path when the dialog is closed and stabilizes the array identity
  // so the dialog's own memos don't re-run on unrelated BoqTab renders.
  const previewSelectedItems = useMemo(
    () =>
      previewOpen
        ? (boq?.items ?? []).filter((it) => selection.selected.has(it.id))
        : [],
    [previewOpen, boq?.items, selection.selected]
  );

  // For homogeneous selections, intersect with the legal sources for the
  // shared phase — otherwise the picker would offer transitions the server
  // is guaranteed to reject. Mixed selections keep the full role-fireable
  // set; the preview dialog resolves per-group legality there.
  const bulkAllowedPhases = useMemo<readonly BoqItemPhase[]>(() => {
    const isPM = role === "pm";
    const isArchitect = role === "architect";
    const isClient = role === "client";
    const isCreator =
      boq?.created_by != null &&
      currentUserId != null &&
      boq.created_by === currentUserId;
    const roleFireable = BOQ_ITEM_PHASES.filter((phase) =>
      canFireBoqPhaseTransition({
        target: phase,
        isPM,
        isArchitect,
        isClient,
        isCreator,
      })
    );
    if (sharedSelectedPhase) {
      const sources = new Set(
        BOQ_ITEM_PHASE_TRANSITIONS[sharedSelectedPhase] ?? []
      );
      return roleFireable.filter((p) => sources.has(p));
    }
    return roleFireable;
  }, [role, currentUserId, boq?.created_by, sharedSelectedPhase]);

  // Bulk action success → exit selection mode entirely (per UX: after one
  // batch action, dismiss the bar). Failures keep the user in selection mode
  // so they can retry / cancel.
  // Errors are surfaced by useBoqMutations as toasts — the catches stay
  // empty so the user lands back in selection mode for retry.
  const handleBulkMove = useCallback(
    (targetSectionId: string | null) =>
      withBulkPending(async () => {
        if (!boq || selection.selected.size === 0) return;
        try {
          await bulkMoveItems(
            boq.id,
            Array.from(selection.selected),
            targetSectionId
          );
          selection.toggleMode();
        } catch {
          /* toasted */
        }
      }),
    [boq, bulkMoveItems, selection, withBulkPending]
  );

  const handleBulkDelete = useCallback(
    () =>
      withBulkPending(async () => {
        if (!boq || selection.selected.size === 0) return;
        try {
          await bulkDeleteItems(boq.id, Array.from(selection.selected));
          setBulkDeleteConfirmOpen(false);
          selection.toggleMode();
        } catch {
          /* toasted */
        }
      }),
    [boq, bulkDeleteItems, selection, withBulkPending]
  );

  const handleBulkSetPhase = useCallback(
    async (phase: BoqItemPhase, comment?: string) => {
      if (!boq || selection.selected.size === 0) return;
      if (!sharedSelectedPhase) {
        setPreviewTarget(phase);
        setPreviewOpen(true);
        return;
      }
      await withBulkPending(async () => {
        try {
          await bulkSetItemPhase(
            boq.id,
            Array.from(selection.selected),
            phase,
            comment ? { comment } : undefined
          );
          selection.toggleMode();
        } catch {
          /* toasted */
        }
      });
    },
    [boq, bulkSetItemPhase, selection, sharedSelectedPhase, withBulkPending]
  );

  const handlePreviewConfirm = useCallback(
    (plan: BulkLifecyclePlanEntry[], comment?: string) =>
      withBulkPending(async () => {
        if (!boq) return;
        // Each per-target call retains its own atomic guarantee for its subset;
        // a partial failure doesn't abort siblings.
        const results = await Promise.allSettled(
          plan.map((entry) =>
            bulkSetItemPhase(
              boq.id,
              entry.itemIds,
              entry.target,
              comment ? { comment } : undefined
            )
          )
        );
        if (results.every((r) => r.status === "fulfilled"))
          selection.toggleMode();
      }),
    [boq, bulkSetItemPhase, selection, withBulkPending]
  );

  // Single-item lifecycle change from the row's "..." menu. Errors are
  // surfaced via toast inside `useBoqMutations`; we just no-op here so
  // the menu can resume normally.
  const handleSetItemPhase = useCallback(
    async (
      item: BoqItemWithComputed,
      target: BoqItemPhase,
      comment?: string
    ) => {
      try {
        await setItemPhase(item.id, target, comment ? { comment } : undefined);
      } catch {
        /* useBoqMutations toasts on error */
      }
    },
    [setItemPhase]
  );

  const handleCreateAndMoveCompleted = useCallback(
    async (sectionId: string) => {
      const item = createAndMoveTarget;
      setCreateAndMoveTarget(null);
      if (!item) return;
      try {
        await moveItem(item, sectionId);
      } catch {
        /* useBoqMutations toasts on error; the new section sticks around for retry */
      }
    },
    [createAndMoveTarget, moveItem]
  );

  // Stable so the import dialog's `runConfirm` deps don't churn across SWR
  // revalidations.
  const handleImported = useCallback(() => {
    trackEvent("boq_imported", { project_id: projectId });
    void mutateBoq();
  }, [mutateBoq, projectId]);

  // Element IDs already in the BOQ — used by the picker to disable
  // already-added rows. Computed before any early return so the hook
  // call order stays stable across renders (rules-of-hooks).
  const existingElementIds = useMemo(
    () =>
      new Set(
        (boq?.items ?? [])
          .map((it) => it.element_id)
          .filter((id): id is string => id !== null)
      ),
    [boq?.items]
  );

  /** Item-count strip for the BOQ header — one bucket per phase. */
  const phaseCounts = useMemo<Record<BoqItemPhase, number>>(() => {
    const counts = Object.fromEntries(
      BOQ_ITEM_PHASES.map((p) => [p, 0])
    ) as Record<BoqItemPhase, number>;
    for (const it of boq?.items ?? []) counts[it.phase] += 1;
    return counts;
  }, [boq?.items]);

  if (isLoading) {
    return <BoqTabSkeleton />;
  }

  if (error) {
    return (
      <div className="px-4 lg:px-10 py-6">
        <p className="text-sm text-error">
          Failed to load BOQ. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <>
        <EmptyState
          icon={FileSpreadsheet}
          title="No BOQ yet"
          description="Create a Bill of Quantities for this project to start tracking costs, margins, and client approvals."
          action={{
            label: "Create BOQ",
            onClick: () => setCreateBoqOpen(true),
          }}
        />
        <BoqCreateDialog
          open={createBoqOpen}
          onOpenChange={setCreateBoqOpen}
          projectId={projectId}
          defaultTitle={projectName}
        />
      </>
    );
  }

  if (!boq) return null;

  const canEdit = role === "pm" || role === "architect";
  // External viewers (client + vendor) see the trimmed table + drawer.
  const isExternal = isExternalViewer(role);
  // Clients get a Select toggle so they can batch-approve / request-changes;
  // vendors don't (they have no bulk action they're allowed to fire).
  const canSelect = canEdit || role === "client";

  const openAddItem = (sectionId: string | null) => {
    setInsertAnchor(null);
    setCreateItemSection(sectionId);
    setCreateItemOpen(true);
  };

  const openInsertItem = (
    item: BoqItemWithComputed,
    position: "above" | "below"
  ) => {
    setInsertAnchor({ itemId: item.id, position });
    setCreateItemSection(item.section_id ?? null);
    setCreateItemOpen(true);
  };

  const openPickerForSection = (sectionId: string | null) => {
    setPickerInitialSection(sectionId);
    setPickerOpen(true);
  };

  const handleToggleVisibility = async (section: BoqSection) => {
    try {
      await updateSection(section.id, {
        isVisibleToClient: !section.is_visible_to_client,
      });
    } catch {
      /* useBoqMutations toasts on error */
    }
  };

  const confirmDeleteSection = async (cascade: boolean) => {
    if (!deleteSectionTarget) return;
    setDeletingSection(true);
    try {
      await deleteSection(deleteSectionTarget, { cascade });
      setDeleteSectionTarget(null);
    } catch {
      /* useBoqMutations toasts on error */
    } finally {
      setDeletingSection(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setDeletingItem(true);
    try {
      await deleteItem(deleteItemTarget);
      setDeleteItemTarget(null);
    } catch {
      /* useBoqMutations toasts on error */
    } finally {
      setDeletingItem(false);
    }
  };

  const confirmRemoveFromScope = async () => {
    if (!rfqBlockedItem) return;
    setExcludingBlocked(true);
    try {
      const res = await setItemExcluded(rfqBlockedItem, true);
      if (res) {
        toast({ title: "Removed from scope", variant: "success" });
        setRfqBlockedItem(null);
      }
    } finally {
      setExcludingBlocked(false);
    }
  };

  const handleReorderSections = (orderedIds: string[]) => {
    if (!boq) return;
    reorderSections(boq.id, orderedIds).catch(() => {
      /* useBoqMutations toasts on error */
    });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await boqApi.downloadExport(projectId);
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(
        blob,
        filename ?? `${projectName || "project"}-BOQ-${stamp}.xlsx`
      );
      trackEvent("boq_exported", {
        project_id: projectId,
        item_count: boq?.items.length ?? 0,
      });
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Export failed";
      toast({ title: "Export failed", description, variant: "error" });
    } finally {
      setExporting(false);
    }
  };

  // Keep drawer's item reference fresh after SWR revalidation.
  const liveDrawerItem = drawerItem
    ? (boq.items.find((it) => it.id === drawerItem.id) ?? null)
    : null;

  return (
    <div className="px-4 lg:px-10 py-6 flex flex-col gap-5">
      <BoqHeader
        title={boq.title}
        boqNumber={boq.boq_number}
        numberingSettingsHref={
          canEdit ? `/projects/${projectId}/settings?section=boq` : undefined
        }
        version={boq.version}
        currency={boq.currency}
        itemCount={boq.items.length}
        // Margin bleed is a studio-only metric — never expose count to clients.
        marginBleedCount={isExternal ? 0 : boq.summary.margin_bleed_count}
        phaseCounts={phaseCounts}
      />

      {/* Summary KPI cards expose cost / margin / over-budget aggregates —
          hidden from clients entirely. The BottomBar already shows the
          client-facing financial breakdown they need. */}
      {!isExternal && (
        <BoqSummaryCards
          summary={boq.summary}
          currency={boq.currency}
          minimumMarginPct={boq.minimum_margin_pct}
        />
      )}

      {canSelect && (
        <BoqActionBar
          canEdit={canEdit}
          onAddItem={() => openAddItem(null)}
          onAddFromLibrary={() => openPickerForSection(null)}
          onAddSection={() => setCreateSectionOpen(true)}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
          exporting={exporting}
          selectionMode={selection.selectionMode}
          onToggleSelectionMode={selection.toggleMode}
        />
      )}

      {/* Source filter is a studio organising tool (library / custom / rate
          contract) — not useful to clients and exposes internal taxonomy. */}
      {!isExternal && (
        <BoqSourceFilter selected={sourceFilter} onChange={setSourceFilter} />
      )}

      <BoqTable
        sections={boq.sections}
        items={boq.items}
        summary={boq.summary}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
        canEdit={canEdit}
        role={role}
        currentUserId={currentUserId}
        boqCreatorId={boq.created_by}
        sourceFilter={sourceFilter}
        onUpdateItem={updateItem}
        onDeleteItem={requestDeleteItem}
        onApplyRate={setApplyRateTarget}
        onMoveItem={moveItem}
        onInsertItem={openInsertItem}
        onCreateAndMoveItem={setCreateAndMoveTarget}
        onSetItemPhase={handleSetItemPhase}
        selection={selection.selectionMode ? selection : undefined}
        onRenameSection={setRenameSection}
        onToggleSectionVisibility={handleToggleVisibility}
        onDeleteSection={setDeleteSectionTarget}
        onAddItemToSection={openAddItem}
        onAddFromLibraryToSection={openPickerForSection}
        onReorderSections={handleReorderSections}
        onOpenItem={setDrawerItem}
      />

      <BoqBottomBar
        projectId={projectId}
        boqId={boq.id}
        summary={boq.summary}
        contingencyPct={boq.contingency_pct}
        vatPct={boq.vat_pct}
        currency={boq.currency}
        canEdit={canEdit}
      />

      <BoqApplyRateDialog
        projectId={projectId}
        item={applyRateTarget}
        onOpenChange={(o) => !o && setApplyRateTarget(null)}
        onApplied={() => void mutateBoq()}
      />

      <BoqCreateSectionDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        projectId={projectId}
        boqId={boq.id}
        nextSortOrder={boq.sections.length}
      />

      <BoqCreateItemSheet
        open={createItemOpen}
        onOpenChange={(open) => {
          setCreateItemOpen(open);
          if (!open) setInsertAnchor(null);
        }}
        projectId={projectId}
        boqId={boq.id}
        sections={boq.sections}
        defaultSectionId={createItemSection}
        anchorItemId={insertAnchor?.itemId ?? null}
        insertPosition={insertAnchor?.position}
      />

      <BoqRenameSectionDialog
        open={renameSection !== null}
        onOpenChange={(open) => {
          if (!open) setRenameSection(null);
        }}
        projectId={projectId}
        section={renameSection}
      />

      <BoqElementPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        boqId={boq.id}
        sections={boq.sections}
        currency={boq.currency}
        existingElementIds={existingElementIds}
        defaultSectionId={pickerInitialSection}
      />

      <ConfirmDialog
        open={deleteItemTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItemTarget(null);
        }}
        title="Delete item?"
        description={
          deleteItemTarget ? (
            <>
              <span className="font-medium text-text-primary">
                Line {deleteItemTarget.line_number}
              </span>
              {` — ${deleteItemTarget.description}. This can't be undone.`}
            </>
          ) : null
        }
        confirmLabel="Delete item"
        destructive
        submitting={deletingItem}
        onConfirm={confirmDeleteItem}
      />

      {/* RFQ-3d: an item on a live RFQ can't be deleted — offer the remedy
          (remove from scope) on the first delete click instead of failing. */}
      <ConfirmDialog
        open={rfqBlockedItem !== null}
        onOpenChange={(open) => {
          if (!open) setRfqBlockedItem(null);
        }}
        title="Remove from scope instead?"
        description={
          rfqBlockedItem ? (
            <>
              <span className="font-medium text-text-primary">
                Line {rfqBlockedItem.line_number}
              </span>
              {` is on an RFQ, so it can't be deleted. Remove it from scope — the line stays for history, drops out of totals, and the RFQ shows it as removed.`}
            </>
          ) : null
        }
        confirmLabel="Remove from scope"
        submitting={excludingBlocked}
        onConfirm={confirmRemoveFromScope}
      />

      <BoqDeleteSectionDialog
        target={deleteSectionTarget}
        itemCount={
          deleteSectionTarget
            ? (boq?.items.filter(
                (it) => it.section_id === deleteSectionTarget.id
              ).length ?? 0)
            : 0
        }
        onOpenChange={(open) => {
          if (!open) setDeleteSectionTarget(null);
        }}
        submitting={deletingSection}
        onConfirm={confirmDeleteSection}
      />

      {/* Row-level "+ Create new section and move here" dialog. Separate
          BoqCreateSectionDialog instance from the top-level "Add section"
          flow so their state stays independent. */}
      <BoqCreateSectionDialog
        open={createAndMoveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCreateAndMoveTarget(null);
        }}
        projectId={projectId}
        boqId={boq.id}
        nextSortOrder={boq.sections.length}
        onCreated={(section) => void handleCreateAndMoveCompleted(section.id)}
      />

      {selection.selectionMode && (
        <BoqBulkActionBar
          count={selection.selected.size}
          sections={boq.sections}
          projectId={projectId}
          boqId={boq.id}
          nextSortOrder={boq.sections.length}
          sharedSectionId={sharedSelectedSectionId}
          sharedPhase={sharedSelectedPhase}
          allowedPhases={bulkAllowedPhases}
          canEdit={canEdit}
          pending={bulkPending}
          onMove={handleBulkMove}
          onSetPhase={handleBulkSetPhase}
          onDelete={() => setBulkDeleteConfirmOpen(true)}
          onCancel={selection.toggleMode}
          skipDestructivePrompt={!sharedSelectedPhase}
        />
      )}

      <BoqBulkLifecyclePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        target={previewTarget}
        selectedItems={previewSelectedItems}
        role={role}
        currentUserId={currentUserId}
        boqCreatorId={boq?.created_by ?? null}
        onConfirm={handlePreviewConfirm}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title={`Delete ${selection.selected.size} item${selection.selected.size === 1 ? "" : "s"}?`}
        description="This permanently removes the selected items. Sections stay in place."
        confirmLabel={`Delete ${selection.selected.size} item${selection.selected.size === 1 ? "" : "s"}`}
        destructive
        submitting={bulkPending}
        onConfirm={handleBulkDelete}
      />

      <BoqItemDrawer
        open={drawerItem !== null && liveDrawerItem !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerItem(null);
        }}
        projectId={projectId}
        item={liveDrawerItem}
        sections={boq.sections}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
        canEdit={canEdit}
        role={role}
        currentUserId={currentUserId}
        boqCreatorId={boq.created_by}
        onDelete={(item) => {
          // Close the drawer first so the confirm dialog isn't stacked
          // on top of the open sheet — single modal layer at a time.
          setDrawerItem(null);
          requestDeleteItem(item);
        }}
        onOpenOtherItem={(itemId) => {
          const next = boq.items.find((it) => it.id === itemId);
          if (!next) return;
          // Let the current drawer play its slide-out before slotting the
          // new item, otherwise the contents would swap mid-sheet without
          // any close animation.
          setDrawerItem(null);
          if (drawerSwapTimer.current) clearTimeout(drawerSwapTimer.current);
          drawerSwapTimer.current = setTimeout(
            () => setDrawerItem(next),
            SHEET_TRANSITION_MS
          );
        }}
      />

      <BoqImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        onImported={handleImported}
      />
    </div>
  );
}

/**
 * Resolve the field value shared across every selected item, or `undefined`
 * if the selection is mixed (or empty). Used by the bulk popovers to render
 * a "Current" hint on whichever row the entire selection is already on.
 */
function sharedFieldAcrossSelection<T>(
  items: ReadonlyArray<BoqItemWithComputed> | undefined,
  selected: ReadonlySet<string>,
  getField: (item: BoqItemWithComputed) => T
): T | undefined {
  if (!items || selected.size === 0) return undefined;
  let shared: T | undefined;
  let seen = false;
  for (const it of items) {
    if (!selected.has(it.id)) continue;
    const value = getField(it);
    if (!seen) {
      shared = value;
      seen = true;
    } else if (shared !== value) {
      return undefined;
    }
  }
  return shared;
}
