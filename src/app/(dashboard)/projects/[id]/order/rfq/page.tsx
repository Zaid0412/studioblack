"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus } from "lucide-react";
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

  const { rows, total, isLoading, isValidating, mutate } = useRfqList(
    projectId,
    {
      search: state.search || undefined,
      status: state.status ?? undefined,
      page: state.page,
      limit: PAGE_SIZE,
    }
  );

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
