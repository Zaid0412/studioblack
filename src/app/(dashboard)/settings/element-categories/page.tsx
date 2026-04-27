"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { ArrowLeft, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/useToast";
import { API } from "@/lib/api/routes";
import { elementCategories } from "@/lib/api";
import { useUserRole } from "@/hooks/useUserRole";
import { features } from "@/config/features";
import type { ElementCategoryNode } from "@/types";
import { flattenCategories } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { CategoryTableRow } from "./_components/CategoryTableRow";
import { CategoryEditDialog } from "@/components/elements/CategoryEditDialog";
import { DeleteConfirmDialog } from "./_components/DeleteConfirmDialog";
import type { CategoryFormSubmit } from "@/components/elements/CategoryForm";

const COLLAPSED_STORAGE_KEY = "element-categories-collapsed";

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

/**
 * Returns a new tree where the children of `parentId` (or the root list if
 * parentId is null) are reordered to match `orderedChildIds`. Pure — does not
 * mutate the input tree.
 */
function reorderSiblings(
  tree: ElementCategoryNode[],
  parentId: string | null,
  orderedChildIds: string[]
): ElementCategoryNode[] {
  const reorder = (children: ElementCategoryNode[]): ElementCategoryNode[] => {
    const byId = new Map(children.map((c) => [c.id, c]));
    return orderedChildIds
      .map((id) => byId.get(id))
      .filter((n): n is ElementCategoryNode => n !== undefined);
  };

  if (parentId === null) return reorder(tree);

  const walk = (nodes: ElementCategoryNode[]): ElementCategoryNode[] =>
    nodes.map((n) =>
      n.id === parentId
        ? { ...n, children: reorder(n.children) }
        : { ...n, children: walk(n.children) }
    );
  return walk(tree);
}

/** Settings page for managing the element-category tree: CRUD, drag-to-reorder, collapse/expand. */
export default function ElementCategoriesSettingsPage() {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const { role, loading: roleLoading } = useUserRole();
  const canManage =
    features.elementLibrary && (role === "pm" || role === "architect");

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
    // View Transitions lets the browser crossfade + tween row positions for us.
    // flushSync forces the DOM mutation to be synchronous inside the callback
    // so startViewTransition can capture the "after" snapshot correctly.
    const supportsViewTransitions =
      typeof document !== "undefined" &&
      typeof (
        document as Document & {
          startViewTransition?: (cb: () => void) => unknown;
        }
      ).startViewTransition === "function";
    if (supportsViewTransitions) {
      (
        document as Document & {
          startViewTransition: (cb: () => void) => unknown;
        }
      ).startViewTransition(() => {
        flushSync(() => setCollapsedIds(next));
      });
    } else {
      setCollapsedIds(next);
    }
  };

  const flat = useMemo(
    () => flattenTree(tree, collapsedIds),
    [tree, collapsedIds]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ElementCategoryNode | null>(null);
  const [presetParentId, setPresetParentId] = useState<
    string | null | undefined
  >(undefined);
  const [deleting, setDeleting] = useState<ElementCategoryNode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeDescendantIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const node = flat.find((r) => r.node.id === activeId)?.node;
    if (!node) return new Set<string>();
    return new Set(collectDescendants(node));
  }, [activeId, flat]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Link from the elements sidebar sets ?from=elements. document.referrer is
  // unreliable with Next.js client-side nav (stays frozen at the initial load
  // referrer), so the entry point tells us explicitly where to go back to.
  const searchParams = useSearchParams();
  const backHref: "/elements" | "/settings" =
    searchParams.get("from") === "elements" ? "/elements" : "/settings";

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeRow = flat.find((r) => r.node.id === active.id);
    const overRow = flat.find((r) => r.node.id === over.id);
    if (!activeRow || !overRow) return;

    // Only reorder within the same parent (dnd-kit sibling sort).
    const activeParent = activeRow.node.parent_id;
    const overParent = overRow.node.parent_id;
    if (activeParent !== overParent) return;

    const siblings = flat
      .filter((r) => r.node.parent_id === activeParent)
      .map((r) => r.node.id);
    const oldIndex = siblings.indexOf(active.id as string);
    const newIndex = siblings.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const key = API.elementCategories();
    const previousTree = tree;
    const optimisticTree = reorderSiblings(tree, activeParent, reordered);

    // Optimistic update — apply the new order to the SWR cache immediately
    // so descendants relocate under the parent in the new position.
    await globalMutate(key, { tree: optimisticTree }, { revalidate: false });

    try {
      await elementCategories.reorder(activeParent, reordered);
      await globalMutate(key);
    } catch (e) {
      // Rollback to the prior tree on failure.
      await globalMutate(key, { tree: previousTree }, { revalidate: false });
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

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
  const disabledParentIds = editing
    ? [editing.id, ...collectDescendants(editing)]
    : [];
  const presetParent = presetParentId
    ? (flat.find((r) => r.node.id === presetParentId)?.node ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {backHref === "/elements" ? t("backToElements") : t("backToSettings")}
      </Link>
      <PageHeader
        title={t("manageCategories")}
        subtitle={t("subtitle")}
        actions={
          <Button type="button" onClick={() => openCreate(null)}>
            <Plus className="w-4 h-4" />
            {t("newCategory")}
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : flat.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            {t("categoryEmpty")}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flat.map((r) => r.node.id)}
              strategy={verticalListSortingStrategy}
            >
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
                      <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 pr-3">
                        {t("categoryName")}
                      </th>
                      <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 px-3">
                        {t("categoryCodePrefix")}
                      </th>
                      <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 px-3">
                        {t("colCategoryElements")}
                      </th>
                      <th className="text-left text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 px-3">
                        {t("colUpdated")}
                      </th>
                      <th className="text-right text-[11px] font-medium text-text-muted uppercase tracking-wider py-2 pl-3">
                        {t("colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flat.map(({ node, depth, hasChildren, isLastSibling }) => (
                      <CategoryTableRow
                        key={node.id}
                        node={node}
                        depth={depth}
                        canAddChild={node.level < 3}
                        hasChildren={hasChildren}
                        isLastSibling={isLastSibling}
                        isCollapsed={collapsedIds.has(node.id)}
                        onToggleCollapse={toggleCollapse}
                        hidden={activeDescendantIds.has(node.id)}
                        onEdit={openEdit}
                        onDelete={setDeleting}
                        onAddChild={(parent) => openCreate(parent.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <CategoryEditDialog
        open={dialogOpen}
        mode={dialogMode}
        editing={editing}
        presetParent={presetParent}
        parentOptions={flattenCategories(tree)}
        disabledParentIds={disabledParentIds}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={deleting !== null}
        target={deleting}
        subtreeElementCount={subtreeCountForDelete}
        submitting={submitting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
