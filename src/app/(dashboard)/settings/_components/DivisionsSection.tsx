"use client";

import { useState } from "react";
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
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
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

/** One draggable division row: reorder handle, code/name edit, toggles, delete. */
function DivisionRow({
  division,
  onRename,
  onToggle,
  onDelete,
}: {
  division: Division;
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
  } = useSortable({ id: division.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface px-3 py-2.5 ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-text-muted hover:text-text-secondary active:cursor-grabbing"
        aria-label={t("reorder")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Input
        defaultValue={division.code}
        aria-label={t("code")}
        className="w-24 font-mono text-xs uppercase"
        onBlur={(e) => onRename(division.id, "code", e.target.value)}
      />
      <Input
        defaultValue={division.name}
        aria-label={t("name")}
        className="flex-1"
        onBlur={(e) => onRename(division.id, "name", e.target.value)}
      />

      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        {t("default")}
        <ToggleSwitch
          checked={division.is_default}
          onChange={(v) => onToggle(division.id, "isDefault", v)}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        {t("enabled")}
        <ToggleSwitch
          checked={division.enabled}
          onChange={(v) => onToggle(division.id, "enabled", v)}
        />
      </label>

      <Button
        variant="ghost"
        size="sm"
        aria-label={t("deleteAction")}
        onClick={() => onDelete(division)}
      >
        <Trash2 className="h-4 w-4 text-text-muted" />
      </Button>
    </div>
  );
}

/**
 * Org-level BOQ Division library manager (Settings → Divisions, PM-only).
 * Divisions are the reusable grouping above BOQ sections — reorder, rename,
 * enable/disable, mark as a default for new projects, add, and restore the
 * starter set. A division still referenced by a BOQ section can't be deleted
 * (disable it instead), which the API enforces.
 */
export function DivisionsSection() {
  const t = useTranslations("divisions");
  const tc = useTranslations("common");
  const { divisions, isLoading, loaded, mutate } = useDivisions();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [toDelete, setToDelete] = useState<Division | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

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
    } catch (err) {
      fail(err);
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
      toast({
        title:
          added > 0 ? t("restoredCount", { count: added }) : t("restoredNone"),
        variant: "success",
      });
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
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
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

      <Card>
        <div className="flex flex-col gap-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={divisions.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              {divisions.map((d) => (
                <DivisionRow
                  key={d.id}
                  division={d}
                  onRename={handleRename}
                  onToggle={handleToggle}
                  onDelete={setToDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          {divisions.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">
              {t("empty")}
            </p>
          )}

          {/* Add a new division */}
          <div className="mt-2 flex items-center gap-3 border-t border-border-default pt-3">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              aria-label={t("code")}
              className="w-24 font-mono text-xs uppercase"
              maxLength={10}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("namePlaceholder")}
              aria-label={t("name")}
              className="flex-1"
              maxLength={150}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
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
