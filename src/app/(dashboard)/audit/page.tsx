"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, Search, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { activityIcons } from "@/lib/activityConstants";

interface AuditEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  project_name: string | null;
}

/** Audit history page showing recent notifications as activity log. */
export default function AuditPage() {
  const t = useTranslations("audit");
  const te = useTranslations("emptyStates");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <SearchInput
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        containerClassName="max-w-md"
      />

      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <table className="w-full">
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
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#666] mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={Search}
                    title={te("auditTitle")}
                    description={te("auditDescription")}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((entry) => {
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
