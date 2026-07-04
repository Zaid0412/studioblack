"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  OptionWithIcon,
} from "@/components/ui/select";
import { RFQ_STATUS_ICONS } from "@/lib/rfqLabels";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/formatDate";
import { useVendorRfqs } from "@/hooks/useRfqs";
import { RFQ_STATUSES } from "@/lib/validations";
import type { RfqStatus } from "@/types";
import { RfqStatusBadge } from "@/components/rfq/RfqStatusBadge";

const ALL = "__all__";
const PAGE_SIZE = 25;

/**
 * Vendor portal RFQ list. Shows every RFQ this vendor was invited to
 * (excluding `draft` and `cancelled`, filtered server-side). The list is
 * read-only in F9 — quote submission ships with F10.
 */
export default function VendorPortalRfqsPage() {
  const t = useTranslations("vendorPortal.rfqList");
  const tNav = useTranslations("nav");
  const router = useRouter();

  const [status, setStatus] = useState<RfqStatus | null>(null);
  const [page, setPage] = useState(1);

  const { rows, total, isLoading, isValidating } = useVendorRfqs({
    status: status ?? undefined,
    page,
    limit: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefreshing = isValidating && !isLoading;
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <PageHeader title={tNav("rfqs")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? ALL}
          onValueChange={(v) => {
            setStatus(v === ALL ? null : (v as RfqStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {RFQ_STATUSES.filter((s) => s !== "draft" && s !== "cancelled").map(
              (s) => (
                <SelectItem key={s} value={s}>
                  <OptionWithIcon icon={RFQ_STATUS_ICONS[s]}>
                    {t(`status.${s}`)}
                  </OptionWithIcon>
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden min-h-[420px] flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated text-text-muted">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">{t("col.number")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col.title")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col.status")}</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  {t("col.items")}
                </th>
                <th className="px-4 py-2.5 font-medium">{t("col.issued")}</th>
                <th className="px-4 py-2.5 font-medium">{t("col.deadline")}</th>
              </tr>
            </thead>
            <tbody
              className={isRefreshing ? "opacity-60 transition-opacity" : ""}
            >
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border-default">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <SkeletonRow />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon={FileText}
                      title={t("empty")}
                      description={t("emptyHint")}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border-default hover:bg-bg-elevated/40 cursor-pointer"
                    onClick={() => router.push(`/vendor-portal/rfqs/${row.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {row.rfq_number}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{row.title}</td>
                    <td className="px-4 py-3">
                      <RfqStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                      {row.item_count}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.issued_date ? formatDate(row.issued_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.response_deadline
                        ? formatDate(row.response_deadline)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showingText={t("pagination", {
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
