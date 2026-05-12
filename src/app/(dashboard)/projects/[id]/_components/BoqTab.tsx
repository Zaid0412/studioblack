"use client";

import { useCallback, useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { BoqTabSkeleton } from "../boq/_components/BoqTabSkeleton";
import { useBoq } from "@/hooks/useBoq";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { useUserRole } from "@/hooks/useUserRole";
import { BoqCreateDialog } from "../boq/_components/BoqCreateDialog";
import { BoqHeader } from "../boq/_components/BoqHeader";
import { BoqSummaryCards } from "../boq/_components/BoqSummaryCards";
import { BoqTable } from "../boq/_components/BoqTable";
import { BoqBottomBar } from "../boq/_components/BoqBottomBar";
import { BoqActionBar } from "../boq/_components/BoqActionBar";
import { BoqSourceFilter } from "../boq/_components/BoqSourceFilter";
import { useBoqSourceFilter } from "../boq/_hooks/useBoqSourceFilter";
import { BoqCreateSectionDialog } from "../boq/_components/BoqCreateSectionDialog";
import { BoqCreateItemSheet } from "../boq/_components/BoqCreateItemSheet";
import { BoqElementPickerDialog } from "../boq/_components/BoqElementPickerDialog";
import { BoqRenameSectionDialog } from "../boq/_components/BoqRenameSectionDialog";
import { BoqItemDrawer } from "../boq/_components/BoqItemDrawer";
import { BoqImportDialog } from "../boq/_components/BoqImportDialog";
import { BoqRequestChangesDialog } from "../boq/_components/BoqRequestChangesDialog";
import { BoqInternalReviewBanner } from "../boq/_components/BoqInternalReviewBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { boq as boqApi, ApiError } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { saveBlob } from "@/lib/download";
import type { BoqItemWithComputed, BoqSection } from "@/types";

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
    updateBoq,
    updateItem,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renameSection, setRenameSection] = useState<BoqSection | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] =
    useState<BoqSection | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] =
    useState<BoqItemWithComputed | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [drawerItem, setDrawerItem] = useState<BoqItemWithComputed | null>(
    null
  );
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const { selected: sourceFilter, setSelected: setSourceFilter } =
    useBoqSourceFilter();

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

  const canEdit =
    (role === "pm" || role === "architect") &&
    boq.status !== "locked" &&
    boq.status !== "superseded";

  // Internal review eligibility — mirrors the server-side
  // `getEligibleReviewers` rule: PM or architect AND not the BOQ creator.
  // Clients are always false (they're already excluded by canEdit).
  const isCreator = !!currentUserId && boq.created_by === currentUserId;
  const canReview = (role === "pm" || role === "architect") && !isCreator;

  /**
   * Internal-review action wrapper — runs the API call inside
   * `transitioning`, mutates the BOQ cache on success so the header
   * flips status immediately, toasts on error, and swallows the
   * promise so the BoqHeader's onClick is fire-and-forget.
   */
  async function runReviewAction(
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setTransitioning(true);
    try {
      await action();
      await mutateBoq();
      toast({ title: successMessage, variant: "success" });
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Try again.";
      toast({ title: "Action failed", description, variant: "error" });
    } finally {
      setTransitioning(false);
    }
  }

  const handleSubmitForReview = () =>
    runReviewAction(
      () => boqApi.submitForReview(projectId),
      "BOQ submitted for internal review"
    );
  const handleCancelReview = () =>
    runReviewAction(
      () => boqApi.cancelReview(projectId),
      "Review cancelled — BOQ is back to draft"
    );
  const handleApprove = () =>
    runReviewAction(() => boqApi.approve(projectId), "BOQ internally approved");
  const handleRequestChangesSubmit = async (comment: string) => {
    setTransitioning(true);
    try {
      await boqApi.requestChanges(projectId, { comment });
      await mutateBoq();
      toast({ title: "Changes requested", variant: "success" });
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Try again.";
      toast({ title: "Action failed", description, variant: "error" });
      throw err; // keep dialog open so the reviewer can retry
    } finally {
      setTransitioning(false);
    }
  };

  const openAddItem = (sectionId: string | null) => {
    setCreateItemSection(sectionId);
    setCreateItemOpen(true);
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

  const confirmDeleteSection = async () => {
    if (!deleteSectionTarget) return;
    setDeletingSection(true);
    try {
      await deleteSection(deleteSectionTarget);
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
        version={boq.version}
        status={boq.status}
        currency={boq.currency}
        itemCount={boq.items.length}
        pendingApprovals={boq.summary.pending_approvals}
        marginBleedCount={boq.summary.margin_bleed_count}
        canEdit={canEdit}
        isCreator={isCreator}
        canReview={canReview}
        internallyApprovedAt={boq.internally_approved_at ?? null}
        internallyApprovedByName={boq.internally_approved_by_name ?? null}
        updatedAt={boq.updated_at}
        transitioning={transitioning}
        onSubmitForReview={handleSubmitForReview}
        onCancelReview={handleCancelReview}
        onApprove={handleApprove}
        onRequestChanges={() => setRequestChangesOpen(true)}
        onTransition={async (next) => {
          setTransitioning(true);
          try {
            await updateBoq({ boqId: boq.id, status: next });
          } catch {
            /* useBoqMutations toasts on error */
          } finally {
            setTransitioning(false);
          }
        }}
      />

      {boq.status === "changes_requested" && (
        <BoqInternalReviewBanner
          reviewerName={boq.changes_requested_by_name ?? null}
          comment={boq.changes_requested_comment}
          requestedAt={boq.changes_requested_at}
        />
      )}

      <BoqRequestChangesDialog
        open={requestChangesOpen}
        onOpenChange={setRequestChangesOpen}
        onSubmit={handleRequestChangesSubmit}
      />

      <BoqSummaryCards
        summary={boq.summary}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
      />

      {canEdit && (
        <BoqActionBar
          onAddItem={() => openAddItem(null)}
          onAddFromLibrary={() => setPickerOpen(true)}
          onAddSection={() => setCreateSectionOpen(true)}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
          exporting={exporting}
        />
      )}

      <BoqSourceFilter selected={sourceFilter} onChange={setSourceFilter} />

      <BoqTable
        sections={boq.sections}
        items={boq.items}
        summary={boq.summary}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
        boqStatus={boq.status}
        canEdit={canEdit}
        sourceFilter={sourceFilter}
        onUpdateItem={updateItem}
        onDeleteItem={async (item) => setDeleteItemTarget(item)}
        onRenameSection={setRenameSection}
        onToggleSectionVisibility={handleToggleVisibility}
        onDeleteSection={setDeleteSectionTarget}
        onAddItemToSection={openAddItem}
        onReorderSections={handleReorderSections}
        onOpenItem={setDrawerItem}
      />

      <BoqBottomBar
        summary={boq.summary}
        contingencyPct={boq.contingency_pct}
        vatPct={boq.vat_pct}
        currency={boq.currency}
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
        onOpenChange={setCreateItemOpen}
        projectId={projectId}
        boqId={boq.id}
        sections={boq.sections}
        defaultSectionId={createItemSection}
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
                {deleteItemTarget.item_code}
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

      <ConfirmDialog
        open={deleteSectionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSectionTarget(null);
        }}
        title="Delete section?"
        description={
          deleteSectionTarget ? (
            <>
              <span className="font-medium text-text-primary">
                {deleteSectionTarget.title}
              </span>
              {
                " — items stay in the BOQ but become unassigned. This can't be undone."
              }
            </>
          ) : null
        }
        confirmLabel="Delete section"
        destructive
        submitting={deletingSection}
        onConfirm={confirmDeleteSection}
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
        onDelete={(item) => {
          // Close the drawer first so the confirm dialog isn't stacked
          // on top of the open sheet — single modal layer at a time.
          setDrawerItem(null);
          setDeleteItemTarget(item);
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
