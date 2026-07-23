"use client";

import { useMemo, useState } from "react";
import useSWR, { preload } from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowUpRight,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { emphasisTags } from "@/components/ui/richText";
import { toast } from "@/components/ui/useToast";
import { divisions as divisionsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { swrFetcher } from "@/lib/swr";
import { useDivisions } from "@/hooks/useDivisions";
import { useDebouncedValue } from "@/hooks/useDebounce";
import type { Division, DivisionUsage } from "@/types";

/** Warm the usage cache before the delete dialog opens (hover/focus the trash). */
const prefetchUsage = (id: string) =>
  preload(API.divisionUsage(id), swrFetcher);

// One grid template shared by the header, every row, and the add row, so the
// Code / Name columns line up exactly and the toggles/actions column aligns.
const ROW_GRID =
  "grid grid-cols-[20px_96px_minmax(0,1fr)_64px_64px_36px] items-center gap-3";

/** One draggable division row: reorder handle, code/name edit, toggles, delete. */
function DivisionRow({
  division,
  draggable,
  onRename,
  onToggle,
  onDelete,
}: {
  division: Division;
  draggable: boolean;
  onRename: (id: string, field: "code" | "name", value: string) => void;
  onToggle: (
    id: string,
    field: "enabled" | "isDefault",
    value: boolean
  ) => void;
  onDelete: (division: Division) => void;
}) {
  const t = useTranslations("divisions");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: division.id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${ROW_GRID} border-t border-border-default px-3 py-2 transition-colors hover:bg-bg-elevated/40 ${
        isDragging ? "bg-bg-elevated opacity-80 shadow-sm" : ""
      }`}
    >
      {draggable ? (
        <button
          type="button"
          className="cursor-grab text-text-muted hover:text-text-secondary active:cursor-grabbing"
          aria-label={t("reorder")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span />
      )}

      <Input
        defaultValue={division.code}
        key={`code-${division.id}-${division.code}`}
        aria-label={t("code")}
        className="h-8 font-mono text-xs uppercase"
        onBlur={(e) => onRename(division.id, "code", e.target.value)}
      />
      <Input
        defaultValue={division.name}
        key={`name-${division.id}-${division.name}`}
        aria-label={t("name")}
        className="h-8"
        onBlur={(e) => onRename(division.id, "name", e.target.value)}
      />

      <div className="flex justify-center">
        <ToggleSwitch
          checked={division.is_default}
          onChange={(v) => onToggle(division.id, "isDefault", v)}
        />
      </div>
      <div className="flex justify-center">
        <ToggleSwitch
          checked={division.enabled}
          onChange={(v) => onToggle(division.id, "enabled", v)}
        />
      </div>

      <button
        type="button"
        aria-label={t("deleteAction")}
        onClick={() => onDelete(division)}
        onMouseEnter={() => prefetchUsage(division.id)}
        onFocus={() => prefetchUsage(division.id)}
        className="flex justify-center text-text-muted transition-colors hover:text-error"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Org-level BOQ Division library manager (Settings → Divisions, PM-only).
 * Divisions are the reusable grouping above BOQ sections — search, reorder,
 * rename, enable/disable, mark as a default for new projects, add, and restore
 * the starter set. A division still referenced by a BOQ section can't be deleted
 * (disable it instead), which the API enforces.
 */
export function DivisionsSection() {
  const t = useTranslations("divisions");
  const tc = useTranslations("common");
  const { divisions, isLoading, loaded, mutate } = useDivisions();
  // Set by the BOQ header's "Divisions" link — lets us offer a precise route
  // back to the BOQ the user came from. Guarded to a project's BOQ page.
  const fromParam = useSearchParams().get("from");
  const backToBoq =
    fromParam &&
    fromParam.startsWith("/projects/") &&
    fromParam.includes("/boq")
      ? fromParam
      : null;
  const [query, setQuery] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [toDelete, setToDelete] = useState<Division | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Where the pending-delete division is used, so the dialog can name the
  // projects blocking it (a BOQ section holds a division even with no lines —
  // the reference the user can't see just by scanning line items).
  const { data: usageData, error: usageError } = useSWR<{
    usage: DivisionUsage[];
  }>(toDelete ? API.divisionUsage(toDelete.id) : null);
  const usage = usageData?.usage ?? [];
  const usageLoading = toDelete !== null && !usageData && !usageError;
  const divisionInUse = usage.length > 0;
  // Only surface the "checking" state if the fetch is actually slow — most
  // resolve in a blink (or are already prefetched from the trash hover), and a
  // loader that flashes for a frame then vanishes reads as jank.
  const loadingSettled = useDebouncedValue(usageLoading, 300);
  const showChecking = usageLoading && loadingSettled;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? divisions.filter(
            (d) =>
              d.code.toLowerCase().includes(q) ||
              d.name.toLowerCase().includes(q)
          )
        : divisions,
    [divisions, q]
  );
  // Dragging only makes sense against the full, unfiltered list.
  const draggable = q === "";

  function ok(title: string) {
    toast({ title, variant: "success" });
  }
  function fail(err: unknown) {
    toast({
      title: tc("error"),
      description: err instanceof Error ? err.message : String(err),
      variant: "error",
    });
  }

  async function handleRename(
    id: string,
    field: "code" | "name",
    value: string
  ) {
    const current = divisions.find((d) => d.id === id);
    const trimmed = value.trim();
    if (!current || !trimmed || trimmed === current[field]) return;
    try {
      await divisionsApi.update(id, { [field]: trimmed });
      await mutate();
      ok(t("saved"));
    } catch (err) {
      fail(err);
      await mutate();
    }
  }

  async function handleToggle(
    id: string,
    field: "enabled" | "isDefault",
    value: boolean
  ) {
    try {
      await divisionsApi.update(id, { [field]: value });
      await mutate();
      ok(
        field === "enabled"
          ? value
            ? t("toastEnabled")
            : t("toastDisabled")
          : t("saved")
      );
    } catch (err) {
      fail(err);
      await mutate();
    }
  }

  async function handleAdd() {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return;
    setAdding(true);
    try {
      await divisionsApi.create({ code, name });
      setNewCode("");
      setNewName("");
      await mutate();
      ok(t("toastAdded"));
    } catch (err) {
      fail(err);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await divisionsApi.remove(toDelete.id);
      setToDelete(null);
      await mutate();
      ok(t("toastDeleted"));
    } catch (err) {
      fail(err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const { added } = await divisionsApi.restoreDefaults();
      await mutate();
      ok(added > 0 ? t("restoredCount", { count: added }) : t("restoredNone"));
    } catch (err) {
      fail(err);
    } finally {
      setRestoring(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = divisions.map((d) => d.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const optimistic = reordered.map((id, i) => {
      const d = divisions.find((x) => x.id === id)!;
      return { ...d, sort_order: i };
    });
    await mutate({ divisions: optimistic }, { revalidate: false });
    try {
      await divisionsApi.reorder(reordered);
      await mutate();
    } catch (err) {
      fail(err);
      await mutate();
    }
  }

  if (isLoading && !loaded) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {backToBoq && (
        <Link
          href={backToBoq}
          className="flex w-fit items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToBoq")}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text-primary">
            {t("title")}
          </h2>
          <p className="text-sm text-text-muted">{t("help")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRestore}
          disabled={restoring}
        >
          <RotateCcw className="h-4 w-4" />
          {t("restore")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="pl-9"
        />
      </div>

      <Card className="p-0">
        {/* Column headers */}
        <div
          className={`${ROW_GRID} px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted`}
        >
          <span />
          <span>{t("code")}</span>
          <span>{t("name")}</span>
          <span className="text-center">{t("default")}</span>
          <span className="text-center">{t("enabled")}</span>
          <span />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((d) => (
              <DivisionRow
                key={d.id}
                division={d}
                draggable={draggable}
                onRename={handleRename}
                onToggle={handleToggle}
                onDelete={setToDelete}
              />
            ))}
          </SortableContext>
        </DndContext>

        {visible.length === 0 && (
          <p className="border-t border-border-default py-6 text-center text-sm text-text-muted">
            {q ? t("noMatches") : t("empty")}
          </p>
        )}

        {/* Add a new division — columns aligned with the rows above. */}
        <div
          className={`${ROW_GRID} border-t border-border-default px-3 py-2.5`}
        >
          <span />
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder={t("codePlaceholder")}
            aria-label={t("code")}
            className="h-8 font-mono text-xs uppercase"
            maxLength={10}
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-label={t("name")}
            className="h-8"
            maxLength={150}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <div className="col-span-3 flex justify-end">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding || !newCode.trim() || !newName.trim()}
            >
              <Plus className="h-4 w-4" />
              {t("add")}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("deleteTitle")}
        description={t.rich("deleteConfirm", {
          ...emphasisTags,
          name: toDelete?.name ?? "",
        })}
        confirmLabel={t("deleteAction")}
        cancelLabel={tc("cancel")}
        destructive
        submitting={deleting}
        confirmDisabled={usageLoading || divisionInUse}
        onConfirm={handleDelete}
      >
        {toDelete &&
          (showChecking ? (
            <div
              aria-busy="true"
              className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-elevated/30 p-3 animate-in fade-in duration-200 ease-out motion-reduce:animate-none"
            >
              <span className="sr-only">{t("usageChecking")}</span>
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : divisionInUse ? (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 animate-in fade-in slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
              <p className="text-sm text-text-secondary">{t("usageIntro")}</p>
              <ul className="flex flex-col divide-y divide-border-default">
                {usage.map((u) => (
                  <li key={u.project_id}>
                    <Link
                      href={`/projects/${u.project_id}/boq`}
                      onClick={() => setToDelete(null)}
                      className="group flex items-center justify-between gap-3 py-1.5 text-sm"
                      title={t("usageOpenBoq", { project: u.project_name })}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-text-primary group-hover:text-accent-strong">
                        <span className="truncate">{u.project_name}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                      </span>
                      <span className="shrink-0 text-text-muted">
                        {[
                          u.item_count > 0 &&
                            t("usageItems", { count: u.item_count }),
                          u.section_count > 0 &&
                            t("usageSections", { count: u.section_count }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null)}
      </ConfirmDialog>
    </div>
  );
}
