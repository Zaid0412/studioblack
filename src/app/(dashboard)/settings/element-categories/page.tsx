"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

interface TreeResponse {
  tree: ElementCategoryNode[];
}

interface FlatRow {
  node: ElementCategoryNode;
  depth: number;
}

function flattenTree(tree: ElementCategoryNode[]): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (nodes: ElementCategoryNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ node: n, depth });
      if (n.children.length > 0) walk(n.children, depth + 1);
    }
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
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ElementCategoryNode | null>(null);
  const [presetParentId, setPresetParentId] = useState<
    string | null | undefined
  >(undefined);
  const [deleting, setDeleting] = useState<ElementCategoryNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const [backHref, setBackHref] = useState<"/elements" | "/settings">(
    "/settings"
  );
  useEffect(() => {
    try {
      const r = document.referrer;
      if (r && new URL(r).pathname.endsWith("/elements")) {
        setBackHref("/elements");
      }
    } catch {
      // malformed referrer — keep the /settings default
    }
  }, []);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
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
    try {
      await elementCategories.reorder(activeParent, reordered);
      await globalMutate(API.elementCategories());
    } catch (e) {
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
  const presetParentName = presetParentId
    ? (flat.find((r) => r.node.id === presetParentId)?.node.name ?? undefined)
    : undefined;

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
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flat.map((r) => r.node.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
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
                    {flat.map(({ node, depth }) => (
                      <CategoryTableRow
                        key={node.id}
                        node={node}
                        depth={depth}
                        canAddChild={node.level < 3}
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
        presetParentId={presetParentId}
        presetParentName={presetParentName}
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
