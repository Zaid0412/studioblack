"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import useSWR from "swr";
import { X, Briefcase } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabeledSearchableSelect } from "@/components/ui/LabeledSearchableSelect";
import {
  SortableHeaderButton,
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";
import { API } from "@/lib/api/routes";
import {
  RATE_CONTRACT_STATUSES,
  type RateContractSortField,
  type SortOrder,
} from "@/lib/validations";
import type { RateContractListRow } from "@/types";
import type { VendorListRow } from "@/lib/api/vendors";
import { RateContractStatusBadge } from "@/components/rate-contracts/RateContractStatusBadge";
import { formatDate } from "@/lib/formatDate";

const ALL = "__all__";
type SortKey = RateContractSortField;

export interface RateContractListState {
  search: string;
  status: string | null;
  vendorId: string | null;
  sortBy: SortKey | null;
  sortOrder: SortOrder | null;
  page: number;
}

interface Props {
  state: RateContractListState;
  rows: RateContractListRow[];
  total: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  isRefreshing: boolean;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string | null) => void;
  onVendorChange: (v: string | null) => void;
  onSortChange: (sortBy: SortKey | null, sortOrder: SortOrder | null) => void;
  onPageChange: (page: number) => void;
  onClear: () => void;
}

/** Rate-contract list table with filters, sortable headers, and pagination. */
export function RateContractList({
  state,
  rows,
  total,
  totalPages,
  pageSize,
  isLoading,
  isRefreshing,
  onSearchChange,
  onStatusChange,
  onVendorChange,
  onSortChange,
  onPageChange,
  onClear,
}: Props) {
  const t = useTranslations("rateContracts");

  const { data: vendorData } = useSWR<{ rows: VendorListRow[] }>(
    `${API.vendors()}?limit=200`
  );
  const vendors = vendorData?.rows ?? [];

  const hasActive =
    state.search ||
    state.status ||
    state.vendorId ||
    state.sortBy ||
    state.page > 1;

  const startIdx = (state.page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

  const sortConfig: SortConfig<SortKey> =
    state.sortBy && state.sortOrder
      ? { key: state.sortBy, direction: state.sortOrder }
      : null;
  const onSort = (key: SortKey) => {
    const next = nextSortDirection(sortConfig, key);
    onSortChange(next?.key ?? null, next?.direction ?? null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="flex-1 min-w-0">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            value={state.search}
            debounceMs={300}
            onDebouncedChange={onSearchChange}
          />
        </div>

        <div className="w-full lg:w-44">
          <Select
            value={state.status ?? ALL}
            onValueChange={(v) => onStatusChange(v === ALL ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
              {RATE_CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full lg:w-56">
          <LabeledSearchableSelect<string>
            value={state.vendorId ?? ""}
            onChange={(id) => onVendorChange(id === "" ? null : id)}
            options={vendors.map((v) => ({
              code: v.id,
              name: v.company_name,
            }))}
            triggerPlaceholder={t("filterVendor")}
            hideTriggerCode
            codeColumnClassName="hidden"
            triggerSize="sm"
            allowClear={{ label: t("allVendors") }}
          />
        </div>

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-4 h-4" />
            {t("clearFilters")}
          </Button>
        )}
      </div>

      <div
        className={`transition-opacity ${
          isRefreshing ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden">
          <div className="hidden lg:grid grid-cols-[140px_1fr_180px_120px_120px_120px_80px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
            <SortableHeaderButton
              sortKey="contract_number"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colNumber")}
            </SortableHeaderButton>
            <SortableHeaderButton
              sortKey="name"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colName")}
            </SortableHeaderButton>
            <div>{t("colVendor")}</div>
            <SortableHeaderButton
              sortKey="status"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colStatus")}
            </SortableHeaderButton>
            <SortableHeaderButton
              sortKey="end_date"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colEndDate")}
            </SortableHeaderButton>
            <div>{t("colItems")}</div>
            <div className="text-right">{t("colActions")}</div>
          </div>

          <div className="flex flex-col">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} columns={7} />
              ))
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("emptyTitle")}
                description={t("emptyHint")}
              />
            ) : (
              rows.map((c) => (
                <Link
                  key={c.id}
                  href={`/elements/rate-contracts/${c.id}`}
                  className="grid grid-cols-1 lg:grid-cols-[140px_1fr_180px_120px_120px_120px_80px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors"
                >
                  <div className="font-mono text-sm text-text-primary truncate">
                    {c.contract_number}
                  </div>
                  <div className="text-sm text-text-primary truncate">
                    {c.name}
                  </div>
                  <div className="text-sm text-text-secondary truncate">
                    {c.vendor_name}
                  </div>
                  <div>
                    <RateContractStatusBadge status={c.status} />
                  </div>
                  <div className="text-sm text-text-secondary">
                    {formatDate(c.end_date)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {c.item_count}
                  </div>
                  <div className="text-right text-sm text-text-muted">→</div>
                </Link>
              ))
            )}
          </div>

          {!isLoading && total > 0 && (
            <Pagination
              currentPage={state.page}
              totalPages={totalPages}
              onPageChange={onPageChange}
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
  );
}
