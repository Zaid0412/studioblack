"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { activities } from "@/data/mock";
import { activityIcons } from "@/lib/activity-constants";

/** Audit history page with searchable activity table. */
export default function AuditPage() {
  const t = useTranslations("audit");
  const te = useTranslations("emptyStates");
  const [search, setSearch] = useState("");

  const filtered = activities.filter(
    (a) =>
      a.action.toLowerCase().includes(search.toLowerCase()) ||
      a.user.toLowerCase().includes(search.toLowerCase()) ||
      a.project.toLowerCase().includes(search.toLowerCase()) ||
      a.details.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <SearchInput
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        containerClassName="max-w-md"
      />

      {/* Activity table */}
      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("action")}
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("user")}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={Search}
                    title={te("auditTitle")}
                    description={te("auditDescription")}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((activity) => {
                const Icon = activityIcons[activity.type] || FolderOpen;
                return (
                  <tr
                    key={activity.id}
                    className="border-b border-border-default last:border-b-0 hover:bg-bg-elevated/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-text-muted" />
                        <span className="text-sm font-medium text-text-primary">
                          {activity.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">
                        {activity.user}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">
                        {activity.project}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-muted">
                        {activity.details}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-muted">
                        {new Date(activity.timestamp).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
