"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { rateContracts as rcApi } from "@/lib/api";
import type { ListRateContractsResponse } from "@/lib/api/rateContracts";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useUserRole } from "@/hooks/useUserRole";
import { useRateContractFilters } from "./_hooks/useRateContractFilters";
import { RateContractList } from "./_components/RateContractList";
import { RateContractFormDialog } from "./_components/RateContractFormDialog";

const PAGE_SIZE = 25;

/** Rate Contracts list page — vendor / status filters, sortable columns, create CTA. */
export default function RateContractsPage() {
  const t = useTranslations("rateContracts");
  const { role } = useUserRole();
  const rateContractsEnabled = useFeatureFlagEnabled("rateContracts") ?? false;

  const { state, setSearch, setStatus, setVendorId, setSort, setPage, clear } =
    useRateContractFilters();

  const params = {
    search: state.search || undefined,
    status: state.status ?? undefined,
    vendorId: state.vendorId ?? undefined,
    sortBy: state.sortBy ?? undefined,
    sortOrder: state.sortOrder ?? undefined,
    page: state.page,
    limit: PAGE_SIZE,
  } as const;

  const key = rcApi.listKey(params);
  const { data, isLoading, isValidating, mutate } =
    useSWR<ListRateContractsResponse>(rateContractsEnabled ? key : null, {
      keepPreviousData: true,
    });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefreshing = isValidating && !isLoading;

  const [formOpen, setFormOpen] = useState(false);

  if (!rateContractsEnabled) {
    return (
      <div className="flex flex-col gap-4 max-w-[1400px]">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <p className="text-sm text-text-muted italic">{t("featureDisabled")}</p>
      </div>
    );
  }

  const canManage = role === "pm" || role === "architect";

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
            {canManage && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4" />
                {t("newContract")}
              </Button>
            )}
          </>
        }
      />

      <RateContractList
        state={state}
        rows={rows}
        total={total}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onVendorChange={setVendorId}
        onSortChange={setSort}
        onPageChange={setPage}
        onClear={clear}
      />

      <RateContractFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={null}
        onSaved={() => mutate()}
      />
    </div>
  );
}
