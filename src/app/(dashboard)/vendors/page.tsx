"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { vendors as vendorsApi } from "@/lib/api";
import { useUserRole } from "@/hooks/useUserRole";
import { useVendors } from "@/hooks/useVendors";
import type { VendorWithRelations } from "@/types";
import type { VendorListRow } from "@/lib/api/vendors";
import { useVendorFilters } from "./_hooks/useVendorFilters";
import { VendorList } from "./_components/VendorList";
import { VendorDrawer } from "./_components/VendorDrawer";
import {
  VendorFormDialog,
  type VendorFormSubmit,
} from "./_components/VendorFormDialog";

/** Vendor management page — gated on the `vendorManagement` feature flag. */
export default function VendorsPage() {
  const t = useTranslations("vendors");

  const { role } = useUserRole();
  const isPm = role === "pm";

  const {
    state,
    setSearch,
    setStatus,
    setKycStatus,
    setTradeCategoryId,
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
    page: state.page,
  });

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorWithRelations | null>(null);

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
        onTradeChange={setTradeCategoryId}
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
