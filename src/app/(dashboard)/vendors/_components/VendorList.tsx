"use client";

import { useTranslations } from "next-intl";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SortableHeaderButton,
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";
import { VENDOR_STATUSES, VENDOR_KYC_STATUSES } from "@/lib/validations";
import type { VendorStatus, VendorKycStatus } from "@/types";
import type { VendorSortField, SortOrder } from "@/lib/validations";
import type { VendorListRow } from "@/lib/api/vendors";
import { VendorRow } from "./VendorRow";
import type { VendorFilterState } from "../_hooks/useVendorFilters";

type SortKey = VendorSortField;

interface Props {
  state: VendorFilterState;
  rows: VendorListRow[];
  total: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  isRefreshing: boolean;
  canDelete: boolean;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: VendorStatus | null) => void;
  onKycStatusChange: (v: VendorKycStatus | null) => void;
  onPreferredChange: (v: boolean) => void;
  onSortChange: (sortBy: SortKey | null, sortOrder: SortOrder | null) => void;
  onPageChange: (page: number) => void;
  onClear: () => void;
  onRowClick: (vendor: VendorListRow) => void;
  onEdit: (vendor: VendorListRow) => void;
  onSoftDelete: (vendor: VendorListRow) => void;
  onHardDelete: (vendor: VendorListRow) => void;
}

const ALL_STATUS = "__all__";

/** Vendors table with filter bar, pagination, and per-row action menu. */
export function VendorList({
  state,
  rows,
  total,
  totalPages,
  pageSize,
  isLoading,
  isRefreshing,
  canDelete,
  onSearchChange,
  onStatusChange,
  onKycStatusChange,
  onPreferredChange,
  onSortChange,
  onPageChange,
  onClear,
  onRowClick,
  onEdit,
  onSoftDelete,
  onHardDelete,
}: Props) {
  const t = useTranslations("vendors");

  const hasActive =
    state.search ||
    state.status ||
    state.kycStatus ||
    state.tradeCategoryId ||
    state.preferred ||
    state.sortBy ||
    state.page > 1;

  const sortConfig: SortConfig<SortKey> =
    state.sortBy && state.sortOrder
      ? { key: state.sortBy, direction: state.sortOrder }
      : null;
  const onSort = (key: SortKey) => {
    const next = nextSortDirection(sortConfig, key);
    onSortChange(next?.key ?? null, next?.direction ?? null);
  };

  const startIdx = (state.page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

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
            value={state.status ?? ALL_STATUS}
            onValueChange={(v) =>
              onStatusChange(v === ALL_STATUS ? null : (v as VendorStatus))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>{t("allStatuses")}</SelectItem>
              {VENDOR_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full lg:w-44">
          <Select
            value={state.kycStatus ?? ALL_STATUS}
            onValueChange={(v) =>
              onKycStatusChange(
                v === ALL_STATUS ? null : (v as VendorKycStatus)
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("filterKyc")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>{t("allKycStatuses")}</SelectItem>
              {VENDOR_KYC_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`kycStatus_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Checkbox
          id="vendor-filter-preferred"
          checked={state.preferred}
          onCheckedChange={onPreferredChange}
          label={t("preferredOnly")}
        />

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
          <div className="hidden lg:grid grid-cols-[140px_1fr_120px_220px_80px_140px_60px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
            <SortableHeaderButton
              sortKey="vendor_code"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colCode")}
            </SortableHeaderButton>
            <SortableHeaderButton
              sortKey="company_name"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colCompany")}
            </SortableHeaderButton>
            <div>{t("colStatus")}</div>
            <div>{t("colPrimaryContact")}</div>
            <div>{t("colTrades")}</div>
            <SortableHeaderButton
              sortKey="rating"
              config={sortConfig}
              onSort={onSort}
              className="w-full"
            >
              {t("colRating")}
            </SortableHeaderButton>
            <div className="text-right">{t("colActions")}</div>
          </div>

          <div className="flex flex-col">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} columns={7} />
              ))
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("noResults")}
                description={t("noResultsHint")}
              />
            ) : (
              rows.map((v) => (
                <VendorRow
                  key={v.id}
                  vendor={v}
                  canDelete={canDelete}
                  onClick={() => onRowClick(v)}
                  onEdit={() => onEdit(v)}
                  onSoftDelete={() => onSoftDelete(v)}
                  onHardDelete={() => onHardDelete(v)}
                />
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
