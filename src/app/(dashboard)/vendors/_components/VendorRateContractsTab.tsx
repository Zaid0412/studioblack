"use client";

import Link from "next/link";
import useSWR from "swr";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { rateContracts as rcApi } from "@/lib/api";
import type { ListRateContractsResponse } from "@/lib/api/rateContracts";
import { formatDate } from "@/lib/formatDate";
import { RateContractStatusBadge } from "@/app/(dashboard)/elements/rate-contracts/_components/RateContractStatusBadge";

interface Props {
  vendorId: string;
  /** Lazy-load only when the tab is active (mirrors the KYC/bank tabs). */
  enabled: boolean;
}

/**
 * Rate Contracts tab inside the VendorDrawer — lists this vendor's contracts
 * (reuses the org-wide list filtered by `vendorId`). Rows link to the shared
 * rate-contract editor; the contracts themselves live under /elements.
 */
export function VendorRateContractsTab({ vendorId, enabled }: Props) {
  const t = useTranslations("vendors");
  const { data, isLoading } = useSWR<ListRateContractsResponse>(
    enabled ? rcApi.listKey({ vendorId, limit: 100 }) : null
  );
  const rows = data?.rows ?? [];

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={FileText}
          title={t("rcEmptyTitle")}
          description={t("rcEmptyHint")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-4">
      {rows.map((rc) => (
        <Link
          key={rc.id}
          href={`/elements/rate-contracts/${rc.id}`}
          className="flex items-center gap-3 rounded-lg border border-border-default px-3 py-2.5 hover:bg-bg-elevated transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-text-muted shrink-0">
                {rc.contract_number}
              </span>
              <span className="text-sm text-text-primary truncate">
                {rc.name}
              </span>
            </div>
            <div className="text-xs text-text-muted truncate">
              {formatDate(rc.start_date)} – {formatDate(rc.end_date)} ·{" "}
              {t("rcItemCount", { count: rc.item_count })}
            </div>
          </div>
          <RateContractStatusBadge status={rc.status} className="shrink-0" />
        </Link>
      ))}
    </div>
  );
}
