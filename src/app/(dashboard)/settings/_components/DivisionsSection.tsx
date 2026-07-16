"use client";

import { useMemo, useState } from "react";
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
import { GripVertical, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { divisions as divisionsApi } from "@/lib/api";
import { useDivisions } from "@/hooks/useDivisions";
import type { Division } from "@/types";

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
  const [query, setQuery] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [toDelete, setToDelete] = useState<Division | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
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
        description={t("deleteConfirm", { name: toDelete?.name ?? "" })}
        confirmLabel={t("deleteAction")}
        cancelLabel={tc("cancel")}
        destructive
        submitting={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
