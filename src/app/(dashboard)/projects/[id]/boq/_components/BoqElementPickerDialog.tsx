"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/useToast";
import { elements as elementsApi, boq as boqApi } from "@/lib/api";
import type { ListElementsResponse } from "@/lib/api/elements";
import { mutate as globalMutate } from "swr";
import { API } from "@/lib/api/routes";
import type { BoqSection } from "@/types";
import { BOQ_NO_SECTION_ID, formatCurrency } from "../_lib/formatters";

interface BoqElementPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  sections: BoqSection[];
  currency: string;
}

const PAGE_LIMIT = 20;

/**
 * Browse the element library and add a library element as a BOQ line item.
 * Description / unit / costs / margin are copied from the element server-side.
 */
export function BoqElementPickerDialog({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  currency,
}: BoqElementPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [sectionId, setSectionId] = useState<string>(BOQ_NO_SECTION_ID);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId(null);
    setQuantity("1");
    setSectionId(BOQ_NO_SECTION_ID);
  }, [open]);

  const listKey = open
    ? elementsApi.listKey({
        search: search || undefined,
        isActive: true,
        page: 1,
        limit: PAGE_LIMIT,
      })
    : null;

  const { data, isLoading } = useSWR<ListElementsResponse>(listKey);

  const rows = data?.rows ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const handleSubmit = async () => {
    if (!selectedId) return;
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({
        title: "Quantity required",
        description: "Enter a positive number.",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      await boqApi.addElement(projectId, {
        boqId,
        sectionId: sectionId === BOQ_NO_SECTION_ID ? null : sectionId,
        elementId: selectedId,
        quantity: qty,
      });
      await globalMutate(API.boq(projectId));
      toast({ title: "Item added from library", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Could not add item",
        description,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add from library</DialogTitle>
          <DialogDescription>
            Pick an element — description, unit, and costs come from the saved
            entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <SearchInput
            placeholder="Search by name, code, or description…"
            debounceMs={200}
            onDebouncedChange={setSearch}
            autoFocus
          />

          <div className="min-h-[240px] max-h-[320px] overflow-y-auto rounded-lg border border-border-default bg-bg-elevated">
            {isLoading && rows.length === 0 ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted gap-2">
                <Package className="h-5 w-5" />
                <span>No elements match.</span>
              </div>
            ) : (
              <ul className="flex flex-col">
                {rows.map((el) => {
                  const active = el.id === selectedId;
                  return (
                    <li key={el.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(el.id)}
                        className={`w-full grid grid-cols-[70px_1fr_70px_90px] gap-2 items-center px-3 py-2 text-left text-sm border-b border-border-default last:border-b-0 transition-colors cursor-pointer ${
                          active
                            ? "bg-accent/10 text-text-primary"
                            : "hover:bg-bg-secondary/60"
                        }`}
                      >
                        <span className="text-xs font-mono text-text-muted truncate">
                          {el.code}
                        </span>
                        <span className="text-text-primary truncate">
                          {el.name}
                        </span>
                        <span className="text-xs text-text-muted text-right">
                          {el.unit}
                        </span>
                        <span className="text-xs text-text-primary text-right tabular-nums">
                          {formatCurrency(
                            el.unit_cost,
                            el.currency || currency
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Section
              </span>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BOQ_NO_SECTION_ID}>
                    (Unassigned)
                  </SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Quantity
              </span>
              <Input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
          </div>

          {selected && (
            <div className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs text-text-muted">
              <span className="font-medium text-text-primary">
                {selected.name}
              </span>
              {selected.description ? ` — ${selected.description}` : ""}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={submitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
          >
            {submitting ? "Adding..." : "Add to BOQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
