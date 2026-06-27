"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { API } from "@/lib/api/routes";
import { vendorCategories } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { VendorCategoryNode } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FlatRow {
  node: VendorCategoryNode;
  depth: number;
}

/** Depth-first flatten of the tree for indented rendering. */
function flatten(nodes: VendorCategoryNode[], depth = 0): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children.length > 0) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

type FormState = {
  mode: "create" | "edit";
  parentId: string | null;
  parentName?: string;
  node?: VendorCategoryNode;
};

/**
 * Vendor category tree manager — create / add-subcategory / edit / delete,
 * up to 3 levels. Operates on the SEPARATE vendor taxonomy (see
 * docs/vendor-taxonomy-plan.md). Surfaced from the vendors page.
 */
export function VendorCategoryManager({ open, onOpenChange }: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");

  const { data, isLoading } = useSWR<{ tree: VendorCategoryNode[] }>(
    open ? API.vendorCategories() : null
  );
  const rows = useMemo(() => flatten(data?.tree ?? []), [data?.tree]);

  const [form, setForm] = useState<FormState | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState<VendorCategoryNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => globalMutate(API.vendorCategories());

  const openCreate = (parent?: VendorCategoryNode) => {
    setForm({
      mode: "create",
      parentId: parent?.id ?? null,
      parentName: parent?.name,
    });
    setName("");
    setCode("");
  };

  const openEdit = (node: VendorCategoryNode) => {
    setForm({ mode: "edit", parentId: node.parent_id, node });
    setName(node.name);
    setCode(node.code ?? "");
  };

  const submit = async () => {
    if (!name.trim() || !form) return;
    setSubmitting(true);
    try {
      if (form.mode === "edit" && form.node) {
        await vendorCategories.update(form.node.id, {
          name: name.trim(),
          code: code.trim() || null,
        });
      } else {
        await vendorCategories.create({
          name: name.trim(),
          code: code.trim() || undefined,
          parentId: form.parentId ?? undefined,
        });
      }
      await refresh();
      setForm(null);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await vendorCategories.remove(deleting.id);
      await refresh();
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

  const formTitle =
    form?.mode === "edit"
      ? t("editCategory")
      : form?.parentName
        ? t("newSubcategoryUnder", { parent: form.parentName })
        : t("newCategory");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("categoriesManageTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <p className="text-[13px] text-text-secondary">
              {t("categoriesManageSubtitle")}
            </p>
            <Button type="button" size="sm" onClick={() => openCreate()}>
              <Plus className="w-4 h-4" />
              {t("newCategory")}
            </Button>
          </div>

          <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-lg border border-border-default">
            {isLoading ? (
              <p className="px-3 py-6 text-sm text-text-muted text-center">…</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-8 text-sm text-text-muted text-center">
                {t("noCategoriesYet")}
              </p>
            ) : (
              <ul className="divide-y divide-border-default">
                {rows.map(({ node, depth }) => (
                  <li
                    key={node.id}
                    className="flex items-center gap-2 py-2 pr-2 hover:bg-bg-elevated/50 transition-colors"
                    style={{ paddingLeft: `${12 + depth * 18}px` }}
                  >
                    <span
                      className={cn(
                        "truncate",
                        depth === 0
                          ? "text-sm font-medium text-text-primary"
                          : "text-[13px] text-text-secondary"
                      )}
                    >
                      {node.name}
                    </span>
                    {node.code && (
                      <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] font-mono text-text-muted">
                        {node.code}
                      </span>
                    )}
                    <div className="ml-auto inline-flex items-center gap-1">
                      {node.level < 3 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreate(node)}
                          aria-label={t("addSubcategory")}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(node)}
                        aria-label={tCommon("edit")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(node)}
                        aria-label={tCommon("delete")}
                        className="text-error hover:text-error"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {form && (
        <Dialog open onOpenChange={(o) => !o && setForm(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Input
                label={t("fieldName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <Input
                label={t("fieldCode")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="JOIN"
                maxLength={10}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setForm(null)}
                  disabled={submitting}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !name.trim()}
                >
                  {submitting ? t("saving") : tCommon("save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("deleteCategoryTitle")}
        description={
          deleting
            ? t("deleteCategoryConfirm", { name: deleting.name })
            : undefined
        }
        destructive
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        submitting={submitting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
