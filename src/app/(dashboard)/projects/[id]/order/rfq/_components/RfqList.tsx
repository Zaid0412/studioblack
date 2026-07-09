"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  OptionWithIcon,
} from "@/components/ui/select";
import { RFQ_STATUS_ICONS } from "@/lib/rfqLabels";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RFQ_STATUSES } from "@/lib/validations";
import type { RfqListRow, RfqStatus } from "@/types";
import { formatDate } from "@/lib/formatDate";
import { useRfqLastViewedReadOnly } from "@/hooks/useRfqLastViewed";
import { RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";
import { RfqRevisionBadge } from "@/components/rfq/RfqRevisionBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ALL = "__all__";

/** Per-row subcomponent so we can call a hook per row (hooks can't be called inside .map). */
function RfqRow({
  row,
  onNavigate,
  t,
}: {
  row: RfqListRow;
  onNavigate: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const lastViewedAt = useRfqLastViewedReadOnly(row.id);
  const allResponded =
    row.responded_count != null && row.responded_count >= row.vendor_count;
  const hasNewQuote =
    row.latest_quote_submitted_at !== null &&
    (lastViewedAt === null || row.latest_quote_submitted_at > lastViewedAt);

  return (
    <tr
      className="border-t border-border-default hover:bg-bg-elevated/40 cursor-pointer"
      onClick={() => onNavigate(row.id)}
    >
      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          {row.rfq_number}
          <RfqRevisionBadge revisionNumber={row.revision_number} />
          {hasNewQuote && (
            <span className="text-xs font-medium text-status-submitted bg-status-submitted/10 px-1.5 py-0.5 rounded">
              New quote
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-text-primary">{row.title}</td>
      <td className="px-4 py-3">
        <RfqStatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
        {row.item_count}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
        {row.responded_count != null && row.vendor_count > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={allResponded ? "text-success" : undefined}>
                {row.responded_count}/{row.vendor_count}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {allResponded
                ? t("responded.all", { total: row.vendor_count })
                : t("responded.partial", {
                    responded: row.responded_count,
                    total: row.vendor_count,
                  })}
            </TooltipContent>
          </Tooltip>
        ) : (
          row.vendor_count
        )}
      </td>
      <td className="px-4 py-3 text-text-secondary">
        {row.response_deadline ? formatDate(row.response_deadline) : "—"}
      </td>
      <td className="px-4 py-3 text-text-muted">
        {formatDate(row.created_at)}
      </td>
    </tr>
  );
}

export interface RfqListState {
  search: string;
  status: RfqStatus | null;
  page: number;
}

interface Props {
  projectId: string;
  state: RfqListState;
  rows: RfqListRow[];
  total: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  isRefreshing: boolean;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: RfqStatus | null) => void;
  onPageChange: (page: number) => void;
  onClear: () => void;
}

/** Studio RFQ list table — filters, status badges, pagination. */
export function RfqList({
  projectId,
  state,
  rows,
  total,
  totalPages,
  pageSize,
  isLoading,
  isRefreshing,
  onSearchChange,
  onStatusChange,
  onPageChange,
  onClear,
}: Props) {
  const t = useTranslations("rfq");
  const router = useRouter();
  const hasFilters = state.search.length > 0 || state.status !== null;
  const showingFrom = total === 0 ? 0 : (state.page - 1) * pageSize + 1;
  const showingTo = Math.min(state.page * pageSize, total);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          containerClassName="flex-1 min-w-[200px] max-w-md"
          placeholder={t("filter.searchPlaceholder")}
          value={state.search}
          debounceMs={250}
          onDebouncedChange={onSearchChange}
        />
        <Select
          value={state.status ?? ALL}
          onValueChange={(v) =>
            onStatusChange(v === ALL ? null : (v as RfqStatus))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filter.allStatuses")}</SelectItem>
            {RFQ_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <OptionWithIcon icon={RFQ_STATUS_ICONS[s]}>
                  {t(`status.${s}`)}
                </OptionWithIcon>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-4 h-4" />
            {t("filter.clear")}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden min-h-[420px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated text-text-muted">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">
                  {t("columns.number")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("columns.title")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("columns.status")}
                </th>
                <th className="px-4 py-2.5 font-medium text-right">
                  {t("columns.items")}
                </th>
                <th className="px-4 py-2.5 font-medium text-right">
                  {t("columns.vendors")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("columns.deadline")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("columns.created")}
                </th>
              </tr>
            </thead>
            <tbody
              className={isRefreshing ? "opacity-60 transition-opacity" : ""}
            >
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border-default">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <SkeletonRow />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon={FileText}
                      title={hasFilters ? t("noResults") : t("noRfqs")}
                      description={
                        hasFilters ? t("noResultsHint") : t("noRfqsHint")
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <RfqRow
                    key={row.id}
                    row={row}
                    t={t}
                    onNavigate={(id) =>
                      router.push(`/projects/${projectId}/order/rfq/${id}`)
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <Pagination
            currentPage={state.page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            showingText={t("pagination.showing", {
              from: showingFrom,
              to: showingTo,
              total,
            })}
          />
        )}
      </div>
    </div>
  );
}
