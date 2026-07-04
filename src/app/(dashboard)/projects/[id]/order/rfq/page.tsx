"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { useUserRole } from "@/hooks/useUserRole";
import { useRfqList } from "@/hooks/useRfqs";
import { RfqList, type RfqListState } from "./_components/RfqList";
import type { RfqStatus } from "@/types";

const PAGE_SIZE = 25;

const INITIAL_STATE: RfqListState = {
  search: "",
  status: null,
  page: 1,
};

/**
 * Studio RFQ list — lives under the Order workflow step, so layout chrome
 * (workflow stepper + Order tabs) is already mounted in `order/layout.tsx`.
 */
export default function OrderRfqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const t = useTranslations("rfq");
  const { role } = useUserRole();
  const canManage = role === "pm" || role === "architect";

  const [state, setState] = useState<RfqListState>(INITIAL_STATE);

  const { rows, total, readyNotInRfq, isLoading, isValidating, mutate } =
    useRfqList(projectId, {
      search: state.search || undefined,
      status: state.status ?? undefined,
      page: state.page,
      limit: PAGE_SIZE,
    });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRefreshing = isValidating && !isLoading;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-10">
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
              <Link href={`/projects/${projectId}/order/rfq/new`}>
                <Button>
                  <Plus className="w-4 h-4" />
                  {t("newRfq")}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* RFQ-3d: nudge when procurement-ready BOQ items aren't on any RFQ yet. */}
      {canManage && readyNotInRfq > 0 && (
        <Link
          href={`/projects/${projectId}/order/rfq/new`}
          className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-text-primary hover:border-accent/60 transition-colors"
        >
          <PackageCheck className="w-5 h-5 text-accent shrink-0" />
          <span className="flex-1 min-w-0">
            {t("readyNotInRfq", { count: readyNotInRfq })}
          </span>
          <span className="text-accent font-medium shrink-0">
            {t("newRfq")}
          </span>
        </Link>
      )}

      <RfqList
        projectId={projectId}
        state={state}
        rows={rows}
        total={total}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onSearchChange={(search) =>
          setState((s) => ({ ...s, search, page: 1 }))
        }
        onStatusChange={(status: RfqStatus | null) =>
          setState((s) => ({ ...s, status, page: 1 }))
        }
        onPageChange={(page) => setState((s) => ({ ...s, page }))}
        onClear={() => setState(INITIAL_STATE)}
      />
    </div>
  );
}
