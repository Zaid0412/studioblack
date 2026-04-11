"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { FolderOpen, Search, Loader2, AlertCircle } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { activityIcons } from "@/lib/activityConstants";
import { formatShortDateTime } from "@/lib/formatDate";
import type { DbNotificationRow } from "@/types";

/** Audit history page showing recent notifications as activity log. */
export default function AuditPage() {
  const t = useTranslations("audit");
  const te = useTranslations("emptyStates");
  const [search, setSearch] = useState("");

  const {
    data: entries = [],
    isLoading: loading,
    error,
    mutate,
  } = useSWR<DbNotificationRow[]>("/api/notifications");

  const filtered = useMemo(
    () =>
      entries.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.description?.toLowerCase().includes(search.toLowerCase()) ||
          a.project_name?.toLowerCase().includes(search.toLowerCase())
      ),
    [entries, search]
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <RefreshButton
            onRefresh={() => {
              mutate();
            }}
          />
        }
      />

      <SearchInput
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        containerClassName="max-w-md"
      />

      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-text-muted">Something went wrong loading audit history.</p>
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={te("auditTitle")}
            description={te("auditDescription")}
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                    {t("action")}
                  </th>
                  <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                    {t("project")}
                  </th>
                  <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                    {t("details")}
                  </th>
                  <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                    {t("date")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const Icon = activityIcons[entry.type] || FolderOpen;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border-default last:border-b-0 hover:bg-bg-elevated/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-text-muted" />
                          <span className="text-sm font-medium text-text-primary">
                            {entry.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-text-secondary">
                          {entry.project_name || "\u2014"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-text-muted">
                          {entry.description || "\u2014"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-text-muted">
                          {formatShortDateTime(entry.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className="flex flex-col lg:hidden">
              {filtered.map((entry) => {
                const Icon = activityIcons[entry.type] || FolderOpen;
                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1.5 px-4 py-3 border-b border-border-default last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-text-muted shrink-0" />
                      <span className="text-sm font-medium text-text-primary truncate">
                        {entry.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      {entry.project_name && (
                        <span className="text-text-secondary">
                          {entry.project_name}
                        </span>
                      )}
                      <span className="ml-auto shrink-0">
                        {new Date(entry.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                    {entry.description && (
                      <span className="text-xs text-text-muted">
                        {entry.description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
