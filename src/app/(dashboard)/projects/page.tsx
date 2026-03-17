"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  MoreVertical,
  Eye,
  Edit,
  Upload,
  Trash2,
  FolderOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DbProjectRow } from "@/types";
import { relativeTime } from "@/lib/format-time";

type FilterTab = "all" | "active" | "completed" | "draft";

const PAGE_SIZE = 10;

/** Projects list with status filter tabs, search, and pagination. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<DbProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function init() {
      const { data: session } = await authClient.getSession();
      if (!session?.user) return;

      // Derive effective role from org membership
      const orgId = session.session.activeOrganizationId;
      if (orgId) {
        try {
          const { data: org } =
            await authClient.organization.getFullOrganization();
          const me = org?.members?.find(
            (m: { userId: string }) => m.userId === session.user.id
          );
          if (me?.role === "owner" || me?.role === "admin") {
            setUserRole("pm");
          } else if (me?.role === "member") {
            setUserRole("architect");
          } else {
            setUserRole(session.user.role ?? null);
          }
        } catch {
          setUserRole(session.user.role ?? null);
        }
      } else {
        setUserRole(session.user.role ?? null);
      }

      // Fetch projects
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          setProjects(await res.json());
        }
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterInProgress") },
    { key: "completed", label: t("filterCompleted") },
    { key: "draft", label: t("filterDraft") },
  ];

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const client = p.client_name || p.client_email || "";
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        client.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = activeFilter === "all" || p.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [projects, search, activeFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const paginatedRows = filtered.slice(startIdx, endIdx);

  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  // Count for active tab badge
  const activeTabCount = filtered.length;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-white font-[family-name:var(--font-cabinet)]">
          {t("title")}
        </h1>
        {userRole === "pm" && (
          <Button onClick={() => router.push("/projects/new")}>
            {t("newProject")}
          </Button>
        )}
      </div>

      {/* Filter bar: search + dropdowns */}
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
        />
        <select className="h-10 w-[160px] rounded-lg bg-[#2A2A2A] border-none text-sm text-[#A0A0A0] px-3 outline-none cursor-pointer">
          <option>{t("allStatus")}</option>
        </select>
        <select className="h-10 w-[160px] rounded-lg bg-[#2A2A2A] border-none text-sm text-[#A0A0A0] px-3 outline-none cursor-pointer">
          <option>{t("sortBy")}</option>
        </select>
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

      {/* Table card */}
      <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-[600px] mb-8">
        {/* Table header */}
        <div className="flex items-center h-11 px-4 bg-[#242424]">
          <div className="flex-1 text-xs font-bold text-[#666666]">
            {t("projectName")}
          </div>
          <div className="w-[140px] text-xs font-bold text-[#666666]">
            {t("client")}
          </div>
          <div className="w-[100px] text-xs font-bold text-[#666666]">
            {t("category")}
          </div>
          <div className="w-[140px] text-xs font-bold text-[#666666]">
            {t("stage")}
          </div>
          <div className="w-[110px] text-xs font-bold text-[#666666]">
            {t("estimate")}
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
              title={te("projectsTitle")}
              description={te("projectsDescription")}
              action={
                userRole === "pm"
                  ? { label: te("projectsAction"), href: "/projects/new" }
                  : undefined
              }
            />
          ) : (
            paginatedRows.map((project) => (
              <div
                key={project.id}
                className="flex items-center h-14 px-4 border-b border-[#333333] last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white truncate block">
                    {project.name}
                  </span>
                </div>
                <div className="w-[140px]">
                  <span className="text-[13px] text-[#A0A0A0]">
                    {project.client_name || project.client_email || "\u2014"}
                  </span>
                </div>
                <div className="w-[100px]">
                  <span className="text-[13px] text-[#A0A0A0]">
                    {project.category
                      ? project.category.charAt(0).toUpperCase() +
                        project.category.slice(1)
                      : "\u2014"}
                  </span>
                </div>
                <div className="w-[140px]">
                  <Badge variant={statusToBadgeVariant(project.status)}>
                    {project.status.charAt(0).toUpperCase() +
                      project.status.slice(1)}
                  </Badge>
                </div>
                <div className="w-[110px]">
                  <span className="text-[13px] text-[#A0A0A0]">{"\u2014"}</span>
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
                          router.push(`/projects/${project.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        {t("viewProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/edit`);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        {t("editProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/upload`);
                        }}
                      >
                        <Upload className="w-4 h-4" />
                        {t("uploadDesign")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t("deleteProject")}
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
