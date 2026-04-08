"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
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
  LayoutList,
  LayoutGrid,
  Calendar,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/useToast";
import { projects as projectsApi } from "@/lib/api";
import type { DbProjectRow } from "@/types";
import { relativeTime } from "@/lib/formatTime";
import { useProjectList, type FilterTab } from "@/hooks/useProjectList";
import { useUserRole } from "@/hooks/useUserRole";

const VIEW_MODE_KEY = "projects-view-mode";

/** Reusable dropdown menu for project actions. */
function ProjectDropdown({
  project,
  isStaff,
  isPm,
  onDelete,
}: {
  project: DbProjectRow;
  isStaff: boolean;
  isPm: boolean;
  onDelete: (project: DbProjectRow) => void;
}) {
  const t = useTranslations("projects");
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors cursor-pointer shrink-0"
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
        {isPm && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
            >
              <Trash2 className="w-4 h-4" />
              {t("deleteProject")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Projects list with status filter tabs, search, and pagination. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const { role: userRole, loading: roleLoading } = useUserRole();
  const swrKey =
    !roleLoading && userRole
      ? userRole === "client"
        ? "/api/client/projects"
        : "/api/projects"
      : null;
  const {
    data: projects = [],
    isLoading: projectsLoading,
    mutate,
  } = useSWR<DbProjectRow[]>(swrKey);
  const loading = roleLoading || projectsLoading;
  const [deleteTarget, setDeleteTarget] = useState<DbProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(VIEW_MODE_KEY) as "list" | "grid") || "list";
  });

  const handleViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

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

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const isStaff = userRole === "pm" || userRole === "architect";
  const isPm = userRole === "pm";

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
        <h1 className="text-xl lg:text-[28px] font-bold text-text-primary font-[family-name:var(--font-cabinet)]">
          {t("title")}
        </h1>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={handleRefresh} />
          {isPm && (
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
          <TooltipProvider delayDuration={300}>
            <div className="hidden lg:flex items-center rounded-lg border border-border-default overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleViewMode("list")}
                    className={`p-2 transition-colors cursor-pointer ${
                      viewMode === "list"
                        ? "bg-bg-elevated text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("listView")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleViewMode("grid")}
                    className={`p-2 transition-colors cursor-pointer ${
                      viewMode === "grid"
                        ? "bg-bg-elevated text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("gridView")}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border-default overflow-x-auto scrollbar-none">
        {filters.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`relative px-4 pb-3 pt-1 text-sm transition-colors cursor-pointer shrink-0 ${
                isActive
                  ? "text-text-primary font-semibold"
                  : "text-text-muted font-medium hover:text-[#999999]"
              }`}
            >
              <span className="flex items-center gap-2">
                {f.label}
                {isActive && (
                  <span className="inline-flex items-center justify-center rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] text-text-primary">
                    {activeTabCount}
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden flex flex-col min-h-0 lg:min-h-[480px] mb-8">
        {loading || roleLoading ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : paginatedRows.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={te("projectsTitle")}
            description={te("projectsDescription")}
            action={
              isPm
                ? { label: te("projectsAction"), href: "/projects/new" }
                : undefined
            }
          />
        ) : (
          <>
            {/* ── Desktop table (hidden on mobile, list mode only) ── */}
            <div
              className={`${viewMode === "list" ? "hidden lg:flex" : "hidden"} flex-col flex-1`}
            >
              {/* Table header */}
              <div className="flex items-center h-11 px-4 bg-bg-elevated">
                <div className="flex-1 text-xs font-bold text-text-muted">
                  {t("projectName")}
                </div>
                {isStaff && (
                  <div className="w-[140px] text-xs font-bold text-text-muted">
                    {t("client")}
                  </div>
                )}
                <div className="w-[100px] text-xs font-bold text-text-muted">
                  {t("category")}
                </div>
                <div className="w-[140px] text-xs font-bold text-text-muted">
                  {t("stage")}
                </div>
                {isStaff && (
                  <div className="w-[110px] text-xs font-bold text-text-muted">
                    {t("estimate")}
                  </div>
                )}
                <div className="w-[80px] text-xs font-bold text-text-muted">
                  {t("updated")}
                </div>
                <div className="w-8" />
              </div>

              {/* Table rows */}
              <div className="flex-1">
                {paginatedRows.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center h-14 px-4 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-text-primary truncate block">
                        {project.name}
                      </span>
                    </div>
                    {isStaff && (
                      <div className="w-[140px] min-w-0 pr-2">
                        <span className="text-[13px] text-text-secondary truncate block">
                          {project.client_name ||
                            project.client_email ||
                            "\u2014"}
                        </span>
                      </div>
                    )}
                    <div className="w-[100px] min-w-0 pr-2">
                      <span className="text-[13px] text-text-secondary capitalize truncate block">
                        {project.category || "\u2014"}
                      </span>
                    </div>
                    <div className="w-[140px] min-w-0 pr-2">
                      <Badge variant={statusToBadgeVariant(project.status)}>
                        <span className="capitalize">{project.status}</span>
                      </Badge>
                    </div>
                    {isStaff && (
                      <div className="w-[110px] min-w-0 pr-2">
                        <span className="text-[13px] text-text-secondary truncate block">
                          {project.estimation_inr != null
                            ? `₹${Number(project.estimation_inr).toLocaleString("en-IN")}`
                            : "\u2014"}
                        </span>
                      </div>
                    )}
                    <div className="w-[80px] min-w-0">
                      <span className="text-[13px] text-text-muted truncate block">
                        {relativeTime(project.updated_at || project.created_at)}
                      </span>
                    </div>
                    <div className="w-8 flex justify-end">
                      <ProjectDropdown
                        project={project}
                        isStaff={isStaff}
                        isPm={isPm}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Desktop grid / tile view (hidden on mobile, grid mode only) ── */}
            <div
              className={`${viewMode === "grid" ? "hidden lg:flex" : "hidden"} flex-col flex-1 p-4`}
            >
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedRows.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col gap-3 p-4 rounded-lg border border-border-default bg-bg-primary hover:border-accent/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary line-clamp-2">
                        {project.name}
                      </span>
                      <ProjectDropdown
                        project={project}
                        isStaff={isStaff}
                        isPm={isPm}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusToBadgeVariant(project.status)}>
                        <span className="capitalize">{project.status}</span>
                      </Badge>
                      {project.category && (
                        <span className="text-xs text-text-muted capitalize">
                          {project.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-text-secondary">
                      {isStaff &&
                        (project.client_name || project.client_email) && (
                          <span className="truncate">
                            {project.client_name || project.client_email}
                          </span>
                        )}
                      {isStaff && project.estimation_inr != null && (
                        <span className="text-text-muted">
                          ₹
                          {Number(project.estimation_inr).toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-default mt-auto">
                      {project.deadline ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.deadline).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span>
                        {relativeTime(project.updated_at || project.created_at)}
                      </span>
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
                  className="flex flex-col gap-2 p-4 border-b border-border-default last:border-b-0 active:bg-bg-elevated/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {project.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusToBadgeVariant(project.status)}>
                        <span className="capitalize">{project.status}</span>
                      </Badge>
                      <ProjectDropdown
                        project={project}
                        isStaff={isStaff}
                        isPm={isPm}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    {isStaff &&
                      (project.client_name || project.client_email) && (
                        <span className="truncate">
                          {project.client_name || project.client_email}
                        </span>
                      )}
                    {project.category && (
                      <span className="capitalize">{project.category}</span>
                    )}
                    <span className="text-text-muted ml-auto shrink-0">
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
                    mutate(
                      (prev) => prev?.filter((p) => p.id !== deleteTarget.id),
                      { revalidate: false }
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
