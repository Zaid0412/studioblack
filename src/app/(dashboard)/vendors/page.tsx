"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ChevronDown, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vendors as vendorsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { buildCategoryMap } from "@/lib/elementCategories";
import { useFlag } from "@/hooks/useFlag";
import { useUserRole } from "@/hooks/useUserRole";
import { useVendors } from "@/hooks/useVendors";
import type { ElementCategoryNode, VendorWithRelations } from "@/types";
import type { VendorListRow } from "@/lib/api/vendors";
import { useVendorFilters } from "./_hooks/useVendorFilters";
import { VendorList } from "./_components/VendorList";
import { VendorCategoryTreeSidebar } from "./_components/VendorCategoryTreeSidebar";
import { VendorDrawer } from "./_components/VendorDrawer";
import {
  VendorFormDialog,
  type VendorFormSubmit,
} from "./_components/VendorFormDialog";

/** Vendor management page — gated on the `vendorManagement` feature flag. */
export default function VendorsPage() {
  const t = useTranslations("vendors");
  const vendorManagementEnabled = useFlag("vendorManagement");

  const { role } = useUserRole();
  const isPm = role === "pm";

  const {
    state,
    setSearch,
    setStatus,
    setKycStatus,
    setTradeCategoryId,
    setPreferred,
    setSort,
    setPage,
    clear,
  } = useVendorFilters();

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
    remove,
    removeHard,
    updateRating,
  } = useVendors({
    search: state.search,
    status: state.status ?? undefined,
    kycStatus: state.kycStatus ?? undefined,
    tradeCategoryId: state.tradeCategoryId ?? undefined,
    preferred: state.preferred ? true : undefined,
    sortBy: state.sortBy ?? undefined,
    sortOrder: state.sortOrder ?? undefined,
    page: state.page,
  });

  // Deduped with the sidebar's fetch (same SWR key) — used for the mobile
  // category button label.
  const { data: catData } = useSWR<{ tree: ElementCategoryNode[] }>(
    API.elementCategories()
  );
  const categoryMap = useMemo(
    () => (catData?.tree ? buildCategoryMap(catData.tree) : new Map()),
    [catData]
  );
  const selectedCategoryLabel = state.tradeCategoryId
    ? (categoryMap.get(state.tradeCategoryId) ?? t("allCategories"))
    : t("allCategories");

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorWithRelations | null>(null);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = async (v: VendorListRow) => {
    try {
      const full = await vendorsApi.get(v.id);
      setEditing(full);
      setDialogOpen(true);
    } catch {
      // toast handled at the API wrapper level
    }
  };

  const openEditFromDrawer = (full: VendorWithRelations) => {
    setEditing(full);
    setDialogOpen(true);
    setDrawerId(null);
  };

  const handleSubmit = async (values: VendorFormSubmit) => {
    if (editing) {
      await update(editing.id, values);
    } else {
      await create(values);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const isRefreshing = isValidating && !isLoading;

  if (!vendorManagementEnabled) {
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
            {isPm && (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" />
                {t("newVendor")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="hidden lg:block">
          <VendorCategoryTreeSidebar
            selectedId={state.tradeCategoryId}
            onSelect={setTradeCategoryId}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setMobileCategoriesOpen(true)}
            className="lg:hidden flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary shadow-sm hover:bg-bg-elevated transition-colors"
          >
            <span className="truncate">{selectedCategoryLabel}</span>
            <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
          </button>

          <VendorList
            state={state}
            rows={rows}
            total={total}
            totalPages={totalPages}
            pageSize={pageSize}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            canDelete={isPm}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onKycStatusChange={setKycStatus}
            onPreferredChange={setPreferred}
            onSortChange={setSort}
            onPageChange={setPage}
            onClear={clear}
            onRowClick={(v) => setDrawerId(v.id)}
            onEdit={openEdit}
            onSoftDelete={(v) => {
              void remove(v.id);
            }}
            onHardDelete={(v) => {
              void removeHard(v.id);
            }}
          />
        </div>
      </div>

      <Dialog
        open={mobileCategoriesOpen}
        onOpenChange={setMobileCategoriesOpen}
      >
        <DialogContent className="lg:hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{t("categories")}</DialogTitle>
          </DialogHeader>
          <VendorCategoryTreeSidebar
            selectedId={state.tradeCategoryId}
            onSelect={(id) => {
              setTradeCategoryId(id);
              setMobileCategoriesOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <VendorDrawer
        vendorId={drawerId}
        onOpenChange={(o) => !o && setDrawerId(null)}
        onEdit={openEditFromDrawer}
        onSoftDelete={async (id) => {
          await remove(id);
        }}
        onHardDelete={async (id) => {
          await removeHard(id);
        }}
        onRatingChange={async (id, rating) => {
          await updateRating(id, rating);
        }}
      />

      <VendorFormDialog
        open={dialogOpen}
        editing={editing}
        submitting={submitting}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
