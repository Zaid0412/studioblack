"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBoq } from "@/hooks/useBoq";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { useUserRole } from "@/hooks/useUserRole";
import { BoqCreateDialog } from "../boq/_components/BoqCreateDialog";
import { BoqSummaryCards } from "../boq/_components/BoqSummaryCards";
import { BoqTable } from "../boq/_components/BoqTable";
import { BoqBottomBar } from "../boq/_components/BoqBottomBar";
import { BoqActionBar } from "../boq/_components/BoqActionBar";
import { BoqCreateSectionDialog } from "../boq/_components/BoqCreateSectionDialog";
import { BoqCreateItemDialog } from "../boq/_components/BoqCreateItemDialog";
import { BoqRenameSectionDialog } from "../boq/_components/BoqRenameSectionDialog";
import type { BoqSection } from "@/types";

interface BoqTabProps {
  projectId: string;
  projectName: string;
}

export function BoqTab({ projectId, projectName }: BoqTabProps) {
  const { boq, notFound, isLoading, error } = useBoq(projectId);
  const { role } = useUserRole();
  const { updateItem, deleteItem, updateSection, deleteSection } =
    useBoqMutations(projectId);

  const [createBoqOpen, setCreateBoqOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createItemSection, setCreateItemSection] = useState<string | null>(
    null
  );
  const [renameSection, setRenameSection] = useState<BoqSection | null>(null);

  if (isLoading) {
    return (
      <div className="px-4 lg:px-10 py-6 flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
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
    role === "pm" && boq.status !== "locked" && boq.status !== "superseded";

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

  const handleDeleteSection = async (section: BoqSection) => {
    const confirmed = window.confirm(
      `Delete section "${section.title}"? Items will be un-assigned, not deleted.`
    );
    if (!confirmed) return;
    try {
      await deleteSection(section);
    } catch {
      /* useBoqMutations toasts on error */
    }
  };

  return (
    <div className="px-4 lg:px-10 py-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text-primary">
            {boq.title}
          </h2>
          <p className="text-xs text-text-muted">
            v{boq.version} · {boq.status} · {boq.currency} · {boq.items.length}{" "}
            item{boq.items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <BoqSummaryCards
        summary={boq.summary}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
      />

      {canEdit && (
        <BoqActionBar
          onAddItem={() => openAddItem(null)}
          onAddSection={() => setCreateSectionOpen(true)}
        />
      )}

      <BoqTable
        sections={boq.sections}
        items={boq.items}
        summary={boq.summary}
        currency={boq.currency}
        minimumMarginPct={boq.minimum_margin_pct}
        boqStatus={boq.status}
        canEdit={canEdit}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        onRenameSection={setRenameSection}
        onToggleSectionVisibility={handleToggleVisibility}
        onDeleteSection={handleDeleteSection}
        onAddItemToSection={openAddItem}
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

      <BoqCreateItemDialog
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
    </div>
  );
}
