"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";
import { RefreshButton } from "@/components/ui/RefreshButton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { elements as elementsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type { Element, ElementCategoryNode, ElementWithDetails } from "@/types";
import { useElementFilters } from "./_hooks/useElementFilters";
import { useElements } from "./_hooks/useElements";
import { CategoryTreeSidebar } from "./_components/CategoryTreeSidebar";
import { ElementFilterBar } from "./_components/ElementFilterBar";
import { ElementTable, buildCategoryMap } from "./_components/ElementTable";
import { ElementFormDialog } from "./_components/ElementFormDialog";

type SubmitValues = Parameters<
  React.ComponentProps<typeof ElementFormDialog>["onSubmit"]
>[0];

/** Element Library page — master catalogue of construction elements. */
export default function ElementsPage() {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const {
    state,
    setSearch,
    setCategoryId,
    setUnit,
    setShowArchived,
    setPage,
    clear,
  } = useElementFilters();

  const {
    rows,
    total,
    totalPages,
    pageSize,
    isLoading,
    isValidating,
    mutate,
    submitting,
    create,
    update,
    archive,
    duplicate,
  } = useElements(state);

  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    API.elementCategories()
  );
  const categoryMap = useMemo(
    () => (catData?.tree ? buildCategoryMap(catData.tree) : new Map()),
    [catData]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ElementWithDetails | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Element | null>(null);
  const [archiving, setArchiving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = async (el: Element) => {
    try {
      const full = await elementsApi.get(el.id);
      setEditing(full);
      setDialogOpen(true);
    } catch {
      // Toast handled in the API wrapper layer
    }
  };

  const handleSubmit = async (values: SubmitValues) => {
    const payload = buildMutationPayload(values);
    if (editing) {
      await update(editing.id, payload);
    } else {
      await create(payload);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archive(archiveTarget.id);
      setArchiveTarget(null);
    } finally {
      setArchiving(false);
    }
  };

  const isRefreshing = isValidating && !isLoading;

  const startIdx = (state.page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <RefreshButton
              onRefresh={() => {
                mutate();
              }}
            />
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t("newElement")}
            </Button>
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <CategoryTreeSidebar
          selectedId={state.categoryId}
          onSelect={setCategoryId}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <ElementFilterBar
            state={state}
            onSearchChange={setSearch}
            onUnitChange={setUnit}
            onShowArchivedChange={(archived) => setShowArchived(archived)}
            onClear={clear}
          />

          <div
            className={`transition-opacity ${
              isRefreshing ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <ElementTable
              rows={rows}
              isLoading={isLoading}
              categoryMap={categoryMap}
              onRowClick={openEdit}
              onEdit={openEdit}
              onDuplicate={(el) => {
                void duplicate(el.id);
              }}
              onArchive={setArchiveTarget}
            />

            {!isLoading && total > 0 && (
              <Pagination
                currentPage={state.page}
                totalPages={totalPages}
                onPageChange={setPage}
                showingText={t("pagination", {
                  from: startIdx + 1,
                  to: endIdx,
                  total,
                })}
              />
            )}
          </div>
        </div>
      </div>

      <ElementFormDialog
        open={dialogOpen}
        editing={editing}
        submitting={submitting}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmArchive")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            {t("confirmArchiveDesc")}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{tCommon("cancel")}</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={archiving}
              onClick={handleArchiveConfirm}
            >
              <Trash2 className="w-4 h-4" />
              {archiving ? tCommon("loading") : t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Normalise form values into the API create/update payload shape. */
function buildMutationPayload(values: SubmitValues) {
  return {
    code: values.code,
    name: values.name,
    description: values.description || undefined,
    categoryId: values.categoryId ?? undefined,
    unit: values.unit,
    unitCost: values.unitCost,
    currency: values.currency,
    materialCost: values.materialCost,
    labourCost: values.labourCost,
    overheadPct: values.overheadPct,
    marginPct: values.marginPct,
    specReference: values.specReference || undefined,
    drawingRef: values.drawingRef || undefined,
    tags: values.tags,
    attributes: values.attributes.map((a, i) => ({
      attribute_key: a.attribute_key,
      attribute_value: a.attribute_value,
      unit: a.unit,
      sort_order: i,
    })),
  };
}
