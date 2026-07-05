"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  Download,
  FolderTree,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "@/components/ui/useToast";
import { elements as elementsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { useFlag } from "@/hooks/useFlag";
import { useCanManageCategories } from "@/hooks/useCanManageCategories";
import { saveBlob } from "@/lib/download";
import type { Element, ElementCategoryNode, ElementWithDetails } from "@/types";
import { useElementFilters } from "../_hooks/useElementFilters";
import { useElements } from "../_hooks/useElements";
import { ElementFilterBar } from "../_components/ElementFilterBar";
import { ElementTable } from "../_components/ElementTable";
import { buildCategoryMap } from "@/lib/elementCategories";
import { ElementFormDialog } from "../_components/ElementFormDialog";
import { ImportDialog } from "../_components/ImportDialog";

type SubmitValues = Parameters<
  React.ComponentProps<typeof ElementFormDialog>["onSubmit"]
>[0];

/** Element Library page — master catalogue of construction elements. */
export default function ElementsPage() {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const elementLibraryEnabled = useFlag("elementLibrary");
  const { canManage: canManageCategories } = useCanManageCategories();

  const {
    state,
    setSearch,
    setCategoryId,
    setUnit,
    setShowArchived,
    setSort,
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
    restore,
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
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, truncated, total, filename } =
        await elementsApi.downloadExport({
          search: state.search || undefined,
          categoryId: state.categoryId || undefined,
          unit: state.unit || undefined,
          isActive: state.isActive,
        });
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(blob, filename ?? `elements-${stamp}.xlsx`);
      if (truncated) {
        toast({
          title: t("exportTruncatedTitle"),
          description: t("exportTruncatedDesc", { total }),
          variant: "warning",
        });
      }
    } catch (err) {
      toast({
        title: t("exportFailed"),
        description: err instanceof Error ? err.message : "",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  };

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

  if (!elementLibraryEnabled) {
    return (
      <div className="flex flex-col gap-4 max-w-[1400px]">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <p className="text-sm text-text-muted italic">{t("featureDisabled")}</p>
      </div>
    );
  }

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
            {canManageCategories && (
              <Button
                variant="secondary"
                onClick={() => router.push("/categories")}
                aria-label={t("manageCategories")}
              >
                <FolderTree className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t("manageCategories")}
                </span>
              </Button>
            )}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="w-4 h-4" />
                {exporting ? tCommon("loading") : t("exportBtn")}
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                {t("importBtn")}
              </Button>
            </div>
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={tCommon("more")}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                    <Download className="w-4 h-4" />
                    {t("exportBtn")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload className="w-4 h-4" />
                    {t("importBtn")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button onClick={openCreate} aria-label={t("newElement")}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("newElement")}</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <ElementFilterBar
          state={state}
          categoryTree={catData?.tree ?? []}
          onSearchChange={setSearch}
          onCategoryChange={setCategoryId}
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
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSortChange={setSort}
            onRowClick={openEdit}
            onEdit={openEdit}
            onDuplicate={(el) => {
              void duplicate(el.id);
            }}
            onArchive={setArchiveTarget}
            onRestore={(el) => {
              void restore(el.id);
            }}
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

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => mutate()}
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
    serviceChargePct: values.serviceChargePct,
    marginPct: values.marginPct,
    clientRate: values.clientRate,
    budgetRate: values.budgetRate,
    specReference: values.specReference || undefined,
    drawingRef: values.drawingRef || undefined,
    tags: values.tags,
    attributes: values.attributes.map((a, i) => ({
      attribute_key: a.attribute_key,
      attribute_value: a.attribute_value,
      unit: a.unit,
      sort_order: i,
    })),
    imageUrl: values.imageUrl,
    drawingFileUrl: values.drawingFileUrl,
    drawingFileName: values.drawingFileName,
    specFileUrl: values.specFileUrl,
    specFileName: values.specFileName,
  };
}
