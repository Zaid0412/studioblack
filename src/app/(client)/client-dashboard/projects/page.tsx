"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Eye,
  FolderOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { relativeTime } from "@/lib/formatTime";

type FilterTab = "all" | "active" | "completed" | "draft";

const PAGE_SIZE = 10;

interface ClientProject {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  deadline: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Client projects list with search, filters, and pagination. */
export default function ClientProjectsPage() {
  const t = useTranslations("projects");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetch("/api/client/projects")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterInProgress") },
    { key: "completed", label: t("filterCompleted") },
    { key: "draft", label: t("filterDraft") },
  ];

  const [prevFilterKey, setPrevFilterKey] = useState("");

  const filtered = useMemo(() => {
    const list = projects.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeFilter === "all" || p.status === activeFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesTab && matchesStatus;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "updated":
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return list;
  }, [projects, search, activeFilter, statusFilter, sortBy]);

  const filterKey = `${search}|${activeFilter}|${statusFilter}|${sortBy}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    if (currentPage !== 1) setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const paginatedRows = filtered.slice(startIdx, endIdx);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  const activeTabCount = filtered.length;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Header */}
      <h1 className="text-[28px] font-bold text-white font-[family-name:var(--font-cabinet)]">
        {t("title")}
      </h1>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="updated">Recently Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#333333]">
        {filters.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`relative px-4 pb-3 pt-1 text-sm transition-colors cursor-pointer ${
                isActive
                  ? "text-white font-semibold"
                  : "text-[#666666] font-medium hover:text-[#999999]"
              }`}
            >
              <span className="flex items-center gap-2">
                {f.label}
                {isActive && (
                  <span className="inline-flex items-center justify-center rounded-full bg-[#242424] px-2 py-0.5 text-[11px] text-white">
                    {activeTabCount}
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F5C518]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[600px] mb-8">
        {/* Table header */}
        <div className="flex items-center h-11 px-4 bg-[#242424]">
          <div className="flex-1 text-xs font-bold text-[#666666]">
            {t("projectName")}
          </div>
          <div className="w-[140px] text-xs font-bold text-[#666666]">
            {t("category")}
          </div>
          <div className="w-[140px] text-xs font-bold text-[#666666]">
            {t("stage")}
          </div>
          <div className="w-[80px] text-xs font-bold text-[#666666]">
            {t("updated")}
          </div>
          <div className="w-8" />
        </div>

        {/* Table body */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
            </div>
          ) : paginatedRows.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={te("clientProjectsTitle")}
              description={te("clientProjectsDescription")}
            />
          ) : (
            paginatedRows.map((project) => (
              <div
                key={project.id}
                className="flex items-center h-14 px-4 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() =>
                  router.push(`/client-dashboard/projects/${project.id}`)
                }
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white truncate block">
                    {project.name}
                  </span>
                  {project.description && (
                    <span className="text-xs text-[#666666] truncate block">
                      {project.description}
                    </span>
                  )}
                </div>
                <div className="w-[140px]">
                  <span className="text-[13px] text-[#A0A0A0]">
                    {project.category
                      ? project.category.charAt(0).toUpperCase() +
                        project.category.slice(1)
                      : "\u2014"}
                  </span>
                </div>
                <div className="w-[140px]">
                  <Badge
                    variant={statusToBadgeVariant(
                      project.status as
                        | "active"
                        | "completed"
                        | "draft"
                        | "archived"
                    )}
                  >
                    {project.status.charAt(0).toUpperCase() +
                      project.status.slice(1)}
                  </Badge>
                </div>
                <div className="w-[80px]">
                  <span className="text-[13px] text-[#666666]">
                    {relativeTime(project.updated_at || project.created_at)}
                  </span>
                </div>
                <div className="w-8 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-md text-[#666666] hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/client-dashboard/projects/${project.id}`
                          );
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        {t("viewProject")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between h-12 px-4 border-t border-[#333333]">
            <span className="text-[13px] text-[#666666]">
              {t("showingProjects", {
                start: startIdx + 1,
                end: endIdx,
                total: filtered.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentPage(num)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer ${
                    num === currentPage
                      ? "bg-[#F5C518] text-[#0D0D0D] font-semibold"
                      : "bg-[#2A2A2A] text-[#A0A0A0] hover:text-white"
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
