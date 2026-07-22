"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { Plus, Upload, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/useToast";
import { API } from "@/lib/api/routes";
import { elementCategories } from "@/lib/api";
import { withViewTransition } from "@/lib/viewTransition";
import { saveBlob } from "@/lib/download";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { useCanManageCategories } from "@/hooks/useCanManageCategories";
import type { ElementCategoryNode } from "@/types";
import { flattenCategories } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { SERVICE_AREA_LEVEL } from "@/lib/categoryCode";
import {
  SortableHeaderButton,
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";
import { CategoryTableRow } from "./_components/CategoryTableRow";
import { CategoryFilterBar } from "./_components/CategoryFilterBar";
import { CategoryEditDialog } from "@/components/elements/CategoryEditDialog";
import { CategoryImportDialog } from "./_components/CategoryImportDialog";
import { DeleteConfirmDialog } from "./_components/DeleteConfirmDialog";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  pruneCategoryTree,
  sortCategoryTree,
  type CategoryFilters,
  type SortField,
} from "./_lib/categoryFilters";
import type { CategoryFormSubmit } from "@/components/elements/CategoryForm";

const COLLAPSED_STORAGE_KEY = "element-categories-collapsed";

/** Stable empty set — passed to flattenTree to render every branch expanded. */
const EMPTY_COLLAPSED: ReadonlySet<string> = new Set();

/** Muted, uppercase header styling to match the table's non-sortable columns. */
const HEADER_CLASS =
  "text-[11px] font-medium uppercase tracking-wider text-text-muted";

interface TreeResponse {
  tree: ElementCategoryNode[];
}

interface FlatRow {
  node: ElementCategoryNode;
  depth: number;
  hasChildren: boolean;
  isLastSibling: boolean;
}

function flattenTree(
  tree: ElementCategoryNode[],
  collapsedIds: ReadonlySet<string>
): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (nodes: ElementCategoryNode[], depth: number) => {
    nodes.forEach((n, i) => {
      const hasChildren = n.children.length > 0;
      out.push({
        node: n,
        depth,
        hasChildren,
        isLastSibling: i === nodes.length - 1,
      });
      if (hasChildren && !collapsedIds.has(n.id)) {
        walk(n.children, depth + 1);
      }
    });
  };
  walk(tree, 0);
  return out;
}

/** Returns the descendant IDs of a node (excluding the node itself). */
function collectDescendants(node: ElementCategoryNode): string[] {
  const out: string[] = [];
  const walk = (n: ElementCategoryNode) => {
    for (const child of n.children) {
      out.push(child.id);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/** Returns sum of element_count across the node + all descendants. */
function subtreeElementCount(node: ElementCategoryNode): number {
  let total = node.element_count ?? 0;
  for (const child of node.children) total += subtreeElementCount(child);
  return total;
}

/** True when the node or any descendant is referenced by live data. */
function subtreeInUse(node: ElementCategoryNode): boolean {
  return node.in_use === true || node.children.some(subtreeInUse);
}

/** Central page for managing the shared category tree: CRUD, search/filter/sort, collapse/expand. */
export default function CategoriesPage() {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const { canManage, loading: roleLoading } = useCanManageCategories();

  const { data, isLoading } = useSWR<TreeResponse>(
    canManage ? API.elementCategories() : null
  );
  const tree = useMemo(() => data?.tree ?? [], [data?.tree]);

  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids)) setCollapsedIds(new Set(ids));
      }
    } catch {
      // malformed value — ignore and start fresh
    }
  }, []);
  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      localStorage.setItem(
        COLLAPSED_STORAGE_KEY,
        JSON.stringify(Array.from(next))
      );
    } catch {
      // storage full or disabled — non-fatal
    }
    withViewTransition(() => setCollapsedIds(next));
  };

  const [filters, setFilters] = useState<CategoryFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortConfig<SortField>>(null);

  const filtering = hasActiveFilters(filters);

  // Prune to matches (keeping ancestors), then sort within each sibling group.
  const viewTree = useMemo(
    () =>
      sortCategoryTree(
        pruneCategoryTree(tree, filters),
        sort?.key ?? null,
        sort?.direction ?? "asc"
      ),
    [tree, filters, sort]
  );

  // While filtering, force every branch open so matches are visible regardless
  // of the persisted collapse state.
  const flat = useMemo(
    () => flattenTree(viewTree, filtering ? EMPTY_COLLAPSED : collapsedIds),
    [viewTree, filtering, collapsedIds]
  );

  // One-time entrance cascade, keyed on the visible top-level id set (sorted)
  // so it fires on load/create/delete/filter but NOT on expand/collapse —
  // those leave membership unchanged and drive their own animation (View
  // Transitions).
  const treeBodyRef = useStaggerReveal<HTMLTableSectionElement>(
    viewTree
      .map((n) => n.id)
      .sort()
      .join(",")
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ElementCategoryNode | null>(null);
  const [presetParentId, setPresetParentId] = useState<
    string | null | undefined
  >(undefined);
  const [deleting, setDeleting] = useState<ElementCategoryNode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await elementCategories.downloadExport();
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(blob, `categories-${stamp}.xlsx`);
    } catch (e) {
      toast({
        title: t("exportFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const openCreate = (parentId?: string | null) => {
    setDialogMode("create");
    setEditing(null);
    setPresetParentId(parentId);
    setDialogOpen(true);
  };

  const openEdit = (node: ElementCategoryNode) => {
    setDialogMode("edit");
    setEditing(node);
    setPresetParentId(undefined);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: CategoryFormSubmit) => {
    setSubmitting(true);
    try {
      if (dialogMode === "edit" && editing) {
        await elementCategories.update(editing.id, {
          name: values.name,
          codePrefix: values.codePrefix ?? null,
          icon: values.icon ?? null,
          color: values.color ?? null,
        });
        toast({ title: t("categoryUpdatedToast") });
      } else {
        await elementCategories.create(values);
        toast({ title: t("categoryCreatedToast") });
      }
      await globalMutate(API.elementCategories());
      setDialogOpen(false);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await elementCategories.remove(deleting.id);
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryDeletedToast") });
      setDeleting(null);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Click a column header to cycle its sort: asc → desc → off.
  const handleSort = (key: SortField) =>
    setSort((s) => nextSortDirection(s, key));

  if (roleLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("manageCategories")} />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("manageCategories")} />
        <Card>
          <p className="text-sm text-text-secondary">{tCommon("error")}</p>
        </Card>
      </div>
    );
  }

  const subtreeCountForDelete = deleting ? subtreeElementCount(deleting) : 0;
  const subtreeReferenced = deleting ? subtreeInUse(deleting) : false;
  const descendantCount = deleting ? collectDescendants(deleting).length : 0;
  const presetParent = presetParentId
    ? (flat.find((r) => r.node.id === presetParentId)?.node ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("manageCategories")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="w-4 h-4" />
              {exporting ? tCommon("loading") : t("exportBtn")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-4 h-4" />
              {t("categoryImportAction")}
            </Button>
            <Button type="button" onClick={() => openCreate(null)}>
              <Plus className="w-4 h-4" />
              {t("newCategory")}
            </Button>
          </>
        }
      />

      {(tree.length > 0 || filtering) && (
        <CategoryFilterBar
          filters={filters}
          onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
          onLevelChange={(level) => setFilters((f) => ({ ...f, level }))}
          onUsageChange={(usage) => setFilters((f) => ({ ...f, usage }))}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : flat.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            {filtering ? t("categoryNoMatches") : t("categoryEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 pr-3">
                    <SortableHeaderButton
                      sortKey="name"
                      config={sort}
                      onSort={handleSort}
                      className={HEADER_CLASS}
                    >
                      {t("categoryName")}
                    </SortableHeaderButton>
                  </th>
                  <th className="text-left py-2 px-3">
                    <SortableHeaderButton
                      sortKey="code"
                      config={sort}
                      onSort={handleSort}
                      className={HEADER_CLASS}
                    >
                      {t("categoryCodePrefix")}
                    </SortableHeaderButton>
                  </th>
                  <th className="text-left py-2 px-3">
                    <SortableHeaderButton
                      sortKey="elements"
                      config={sort}
                      onSort={handleSort}
                      className={HEADER_CLASS}
                    >
                      {t("colCategoryElements")}
                    </SortableHeaderButton>
                  </th>
                  <th className="text-left py-2 px-3">
                    <SortableHeaderButton
                      sortKey="updated"
                      config={sort}
                      onSort={handleSort}
                      className={HEADER_CLASS}
                    >
                      {t("colUpdated")}
                    </SortableHeaderButton>
                  </th>
                  <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 pl-3">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody ref={treeBodyRef}>
                {flat.map(({ node, depth, hasChildren, isLastSibling }) => (
                  <CategoryTableRow
                    key={node.id}
                    node={node}
                    depth={depth}
                    canAddChild={node.level < SERVICE_AREA_LEVEL}
                    hasChildren={hasChildren}
                    isLastSibling={isLastSibling}
                    isCollapsed={!filtering && collapsedIds.has(node.id)}
                    onToggleCollapse={toggleCollapse}
                    onEdit={openEdit}
                    onDelete={setDeleting}
                    onAddChild={(parent) => openCreate(parent.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CategoryEditDialog
        open={dialogOpen}
        mode={dialogMode}
        editing={editing}
        presetParent={presetParent}
        parentOptions={flattenCategories(tree)}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={deleting !== null}
        target={deleting}
        subtreeElementCount={subtreeCountForDelete}
        subtreeReferenced={subtreeReferenced}
        descendantCount={descendantCount}
        submitting={submitting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={handleDelete}
      />

      <CategoryImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
