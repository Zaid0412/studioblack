"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Eye,
  Edit,
  Upload,
  Trash2,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { Button } from "@/components/ui/button";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "@/components/ui/useToast";
import { projects as projectsApi, clientPortal } from "@/lib/api";
import type { DbProjectRow } from "@/types";
import { relativeTime } from "@/lib/formatTime";
import { useProjectList, type FilterTab } from "@/hooks/useProjectList";
import { useUserRole } from "@/hooks/useUserRole";

/** Projects list with status filter tabs, search, and pagination. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const { role: userRole, loading: roleLoading } = useUserRole();
  const [projects, setProjects] = useState<DbProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DbProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    search,
    setSearch,
    activeFilter,
    setActiveFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    filtered,
    paginatedRows,
    totalPages,
    startIdx,
    endIdx,
    activeTabCount,
  } = useProjectList({
    items: projects,
    searchFilter: (p, query) => {
      const q = query.toLowerCase();
      const client =
        (p as DbProjectRow).client_name ||
        (p as DbProjectRow).client_email ||
        "";
      return (
        p.name.toLowerCase().includes(q) || client.toLowerCase().includes(q)
      );
    },
  });

  useEffect(() => {
    if (roleLoading || !userRole) return;

    async function fetchProjects() {
      try {
        if (userRole === "client") {
          // Client API returns a simpler shape — cast to match table columns
          const data = await clientPortal.listProjects<DbProjectRow>();
          setProjects(data);
        } else {
          setProjects(await projectsApi.list<DbProjectRow>());
        }
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [userRole, roleLoading]);

  const handleRefresh = useCallback(async () => {
    try {
      if (userRole === "client") {
        setProjects(await clientPortal.listProjects<DbProjectRow>());
      } else {
        setProjects(await projectsApi.list<DbProjectRow>());
      }
    } catch {
      /* keep current list on refresh failure */
    }
  }, [userRole]);

  const isStaff = userRole === "pm" || userRole === "architect";

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterInProgress") },
    { key: "completed", label: t("filterCompleted") },
    { key: "draft", label: t("filterDraft") },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-[28px] font-bold text-white font-[family-name:var(--font-cabinet)]">
          {t("title")}
        </h1>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={handleRefresh} />
          {userRole === "pm" && (
            <Button onClick={() => router.push("/projects/new")}>
              {t("newProject")}
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar: search + dropdowns */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
        />
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 lg:w-[160px]">
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
            <SelectTrigger className="flex-1 lg:w-[160px]">
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
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#333333] overflow-x-auto scrollbar-none">
        {filters.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`relative px-4 pb-3 pt-1 text-sm transition-colors cursor-pointer shrink-0 ${
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

      {/* Content area */}
      <div className="rounded-[10px] bg-[#1A1A1A] border border-[#333333] overflow-hidden flex flex-col min-h-0 lg:min-h-[600px] mb-8">
        {loading || roleLoading ? (
          <div className="flex items-center justify-center py-12 flex-1">
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
          <>
            {/* ── Desktop table (hidden on mobile) ── */}
            <div className="hidden lg:flex flex-col flex-1">
              {/* Table header */}
              <div className="flex items-center h-11 px-4 bg-[#242424]">
                <div className="flex-1 text-xs font-bold text-[#666666]">
                  {t("projectName")}
                </div>
                {isStaff && (
                  <div className="w-[140px] text-xs font-bold text-[#666666]">
                    {t("client")}
                  </div>
                )}
                <div className="w-[100px] text-xs font-bold text-[#666666]">
                  {t("category")}
                </div>
                <div className="w-[140px] text-xs font-bold text-[#666666]">
                  {t("stage")}
                </div>
                {isStaff && (
                  <div className="w-[110px] text-xs font-bold text-[#666666]">
                    {t("estimate")}
                  </div>
                )}
                <div className="w-[80px] text-xs font-bold text-[#666666]">
                  {t("updated")}
                </div>
                <div className="w-8" />
              </div>

              {/* Table rows */}
              <div className="flex-1">
                {paginatedRows.map((project) => (
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
                    {isStaff && (
                      <div className="w-[140px]">
                        <span className="text-[13px] text-[#A0A0A0]">
                          {project.client_name ||
                            project.client_email ||
                            "\u2014"}
                        </span>
                      </div>
                    )}
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
                    {isStaff && (
                      <div className="w-[110px]">
                        <span className="text-[13px] text-[#A0A0A0]">
                          {"\u2014"}
                        </span>
                      </div>
                    )}
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
                          {isStaff && (
                            <>
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
                            </>
                          )}
                          {userRole === "pm" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                {t("deleteProject")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Mobile card list (hidden on desktop) ── */}
            <div className="flex flex-col gap-0 lg:hidden flex-1">
              {paginatedRows.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-2 p-4 border-b border-[#333333] last:border-b-0 active:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {project.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusToBadgeVariant(project.status)}>
                        {project.status.charAt(0).toUpperCase() +
                          project.status.slice(1)}
                      </Badge>
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
                          {isStaff && (
                            <>
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
                            </>
                          )}
                          {userRole === "pm" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                {t("deleteProject")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#A0A0A0]">
                    {isStaff &&
                      (project.client_name || project.client_email) && (
                        <span className="truncate">
                          {project.client_name || project.client_email}
                        </span>
                      )}
                    {project.category && (
                      <span>
                        {project.category.charAt(0).toUpperCase() +
                          project.category.slice(1)}
                      </span>
                    )}
                    <span className="text-[#666666] ml-auto shrink-0">
                      {relativeTime(project.updated_at || project.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            showingText={t("showingProjects", {
              start: startIdx + 1,
              end: endIdx,
              total: filtered.length,
            })}
          />
        )}
      </div>

      {/* Delete confirmation dialog (PM only) */}
      {isStaff && (
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Delete &ldquo;{deleteTarget?.name}&rdquo;?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete the project and all its files,
                phases, and reviews. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">{tc("cancel")}</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={deleting}
                onClick={async () => {
                  if (!deleteTarget) return;
                  setDeleting(true);
                  try {
                    await projectsApi.remove(deleteTarget.id);
                    setProjects((prev) =>
                      prev.filter((p) => p.id !== deleteTarget.id)
                    );
                    toast({
                      title: "Project deleted",
                      description: `"${deleteTarget.name}" has been deleted.`,
                      variant: "success",
                    });
                  } catch (err) {
                    toast({
                      title: tc("error"),
                      description:
                        err instanceof Error
                          ? err.message
                          : "Failed to delete project",
                      variant: "error",
                    });
                  } finally {
                    setDeleting(false);
                    setDeleteTarget(null);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? tc("loading") : tc("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
