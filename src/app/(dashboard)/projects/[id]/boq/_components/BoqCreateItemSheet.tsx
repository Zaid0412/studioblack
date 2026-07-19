"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEFAULT_CURRENCY, DEFAULT_ELEMENT_UNIT } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/TagInput";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { toast } from "@/components/ui/useToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { elements as elementsApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { isNeedsRenumberError, type CreateItemPayload } from "@/lib/api/boq";
import type { SimilarElementsResponse } from "@/lib/api/elements";
import { useDebouncedValue } from "@/hooks/useDebounce";
import type { BoqSection, Element } from "@/types";
import type { ElementUnit } from "@/lib/validations";
import {
  ServiceAreaField,
  useCategoryTree,
} from "@/components/elements/ServiceAreaField";
import { categoryPrefixOf } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { UNCATEGORIZED_PREFIX } from "@/lib/categoryCode";
import {
  BOQ_NO_SECTION_ID,
  DEFAULT_DIMENSION_UNIT,
  convertDimensions,
  formatFeetInches,
  parseDimensionValue,
  parseOptionalNumber,
  type DimensionUnit,
} from "../_lib/formatters";
import { BoqDimensionUnitToggle } from "./BoqDimensionUnitToggle";
import { BoqSectionSelect } from "./BoqSectionSelect";
import { BoqDivisionSelect } from "./BoqDivisionSelect";

interface Attribute {
  attribute_key: string;
  attribute_value: string;
  unit?: string;
}

interface FormState {
  imageUrl: string | null;
  name: string;
  sectionId: string;
  /** The line's Division (mandatory). Drives its per-division line number. */
  divisionId: string | null;
  description: string;
  unit: ElementUnit;
  currency: string;
  quantity: string;
  unitCost: string;
  marginPct: string;
  materialCost: string;
  labourCost: string;
  overheadPct: string;
  serviceChargePct: string;
  clientRate: string;
  budgetRate: string;
  length: string;
  breadth: string;
  height: string;
  dimensionUnit: DimensionUnit;
  specReference: string;
  drawingRef: string;
  drawingFileUrl: string | null;
  drawingFileName: string | null;
  specFileUrl: string | null;
  specFileName: string | null;
  tags: string[];
  attributes: Attribute[];
  notes: string;
  /**
   * The line's Service Area (level 3 — required). Classifies the BOQ item so it
   * matches rate contracts / drives vendor suggestion even when it's free-text
   * (not saved to the library). Reused as the element's category when saving.
   */
  categoryId: string | null;
}

const INITIAL: FormState = {
  imageUrl: null,
  name: "",
  sectionId: BOQ_NO_SECTION_ID,
  divisionId: null,
  description: "",
  unit: DEFAULT_ELEMENT_UNIT,
  currency: DEFAULT_CURRENCY,
  quantity: "1",
  unitCost: "0",
  marginPct: "15",
  materialCost: "",
  labourCost: "",
  overheadPct: "0",
  serviceChargePct: "0",
  clientRate: "",
  budgetRate: "",
  length: "",
  breadth: "",
  height: "",
  dimensionUnit: DEFAULT_DIMENSION_UNIT,
  specReference: "",
  drawingRef: "",
  drawingFileUrl: null,
  drawingFileName: null,
  specFileUrl: null,
  specFileName: null,
  tags: [],
  attributes: [],
  notes: "",
  categoryId: null,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  boqId: string;
  sections: BoqSection[];
  /** Pre-selected section (e.g., opened from a section's menu). */
  defaultSectionId?: string | null;
  /**
   * Insert-between mode: place the new line above/below this anchor row (taking
   * the midpoint of the gap) instead of appending to the section.
   */
  anchorItemId?: string | null;
  insertPosition?: "above" | "below";
}

/**
 * Add a manual BoQ line. Every line links a library element (PRD 2.2): as the
 * user types a Service Area + description, similar elements are suggested for
 * reuse (Scenario 1); otherwise the server auto-creates a `custom` element on
 * save and links it (Scenario 2). All element-detail fields (image, currency,
 * refs, files, tags, attributes) are snapshotted onto that auto-created element.
 */
export function BoqCreateItemSheet({
  open,
  onOpenChange,
  projectId,
  boqId,
  sections,
  defaultSectionId,
  anchorItemId,
  insertPosition,
}: Props) {
  const { createItem } = useBoqMutations(projectId);
  const [v, setV] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const isInsert = !!anchorItemId;
  // Set when an insert hit a full section — holds the payload to retry with
  // allowRenumber once the user confirms.
  const [renumberPayload, setRenumberPayload] =
    useState<CreateItemPayload | null>(null);
  // Tracks whether the user has manually edited Qty in this session.
  // Once true, dimension edits stop overwriting Qty so a manual
  // override sticks for the rest of the session. Resets every time
  // the sheet opens.
  const [manualQty, setManualQty] = useState(false);
  // Set when the user reuses a suggested library element (Scenario 1) — the line
  // links it instead of the server auto-creating one.
  const [linkedElement, setLinkedElement] = useState<{
    id: string;
    code: string;
    name: string;
  } | null>(null);

  const {
    isServiceAreaId,
    options,
    loaded: treeLoaded,
  } = useCategoryTree(open);

  // Project-level BOQ defaults (Settings → BOQ) pre-fill a new line's unit and
  // service charge; null falls back to INITIAL's global defaults.
  const { data: project } = useSWR<{
    default_unit: string | null;
    default_service_charge_pct: string | null;
  }>(API.project(projectId));

  // Division a pre-selected section sits under (opened from a section's menu),
  // so the mandatory Division defaults to match. A primitive, so the reset
  // effect below doesn't re-fire on every `sections` identity change.
  const defaultDivisionId = useMemo(
    () =>
      defaultSectionId
        ? (sections.find((s) => s.id === defaultSectionId)?.division_id ?? null)
        : null,
    [defaultSectionId, sections]
  );

  useEffect(() => {
    if (!open) return;
    setV({
      ...INITIAL,
      sectionId: defaultSectionId ?? BOQ_NO_SECTION_ID,
      divisionId: defaultDivisionId,
      unit: (project?.default_unit ?? INITIAL.unit) as ElementUnit,
      serviceChargePct:
        project?.default_service_charge_pct ?? INITIAL.serviceChargePct,
    });
    setManualQty(false);
    setLinkedElement(null);
  }, [open, defaultSectionId, defaultDivisionId, project]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  // Sections offered for the chosen division: those under it, plus Unassigned
  // (division-less) sections. Before a division is picked, all are shown.
  const sectionsForDivision = useMemo(
    () =>
      v.divisionId
        ? sections.filter(
            (s) => s.division_id === v.divisionId || s.division_id === null
          )
        : sections,
    [sections, v.divisionId]
  );

  // Changing the division clears a section that belonged to a different one.
  const changeDivision = (divisionId: string) =>
    setV((prev) => {
      const sec =
        prev.sectionId === BOQ_NO_SECTION_ID
          ? null
          : sections.find((s) => s.id === prev.sectionId);
      const keep =
        !sec || sec.division_id === null || sec.division_id === divisionId;
      return {
        ...prev,
        divisionId,
        sectionId: keep ? prev.sectionId : BOQ_NO_SECTION_ID,
      };
    });

  // Picking a section that has a division locks the line's division to it.
  const changeSection = (sectionId: string) =>
    setV((prev) => {
      const sec =
        sectionId === BOQ_NO_SECTION_ID
          ? null
          : sections.find((s) => s.id === sectionId);
      return {
        ...prev,
        sectionId,
        divisionId: sec?.division_id ?? prev.divisionId,
      };
    });

  // Inline dedup suggestions (PRD 2.2): once a Service Area + a description are
  // present and the line isn't already linked, look for similar library elements
  // so the user can reuse one instead of the server auto-creating a duplicate.
  // Debounced so it doesn't fire on every keystroke.
  const debouncedDesc = useDebouncedValue(v.description.trim(), 350);
  const similarKey =
    !linkedElement && isServiceAreaId(v.categoryId) && debouncedDesc.length >= 3
      ? elementsApi.similarKey({
          categoryId: v.categoryId,
          q: debouncedDesc,
          tags: v.tags,
        })
      : null;
  const { data: similar } = useSWR<SimilarElementsResponse>(similarKey);
  const suggestions = similar?.rows ?? [];

  // Reuse a suggested element: link it + prefill the line's cost fields from it
  // (the user can still tweak). Keeps the user's own description.
  const reuseElement = (el: Element) => {
    setLinkedElement({ id: el.id, code: el.code, name: el.name });
    setV((prev) => ({
      ...prev,
      name: el.name,
      unit: (el.unit as ElementUnit) ?? prev.unit,
      currency: el.currency ?? prev.currency,
      // Adopt the element's costs, but keep what the user already typed where the
      // element has none (don't wipe a filled field with a blank).
      unitCost: String(el.unit_cost ?? prev.unitCost),
      materialCost:
        el.material_cost != null ? String(el.material_cost) : prev.materialCost,
      labourCost:
        el.labour_cost != null ? String(el.labour_cost) : prev.labourCost,
      overheadPct:
        el.overhead_pct != null ? String(el.overhead_pct) : prev.overheadPct,
      serviceChargePct:
        el.service_charge_pct != null
          ? String(el.service_charge_pct)
          : prev.serviceChargePct,
      marginPct: el.margin_pct != null ? String(el.margin_pct) : prev.marginPct,
      clientRate:
        el.client_rate != null ? String(el.client_rate) : prev.clientRate,
      budgetRate:
        el.budget_rate != null ? String(el.budget_rate) : prev.budgetRate,
      tags: el.tags ?? prev.tags,
    }));
  };

  const addAttribute = () =>
    setV((prev) => ({
      ...prev,
      attributes: [
        ...prev.attributes,
        { attribute_key: "", attribute_value: "", unit: undefined },
      ],
    }));

  const removeAttribute = (i: number) =>
    setV((prev) => ({
      ...prev,
      attributes: prev.attributes.filter((_, idx) => idx !== i),
    }));

  const setAttribute = (i: number, patch: Partial<Attribute>) =>
    setV((prev) => ({
      ...prev,
      attributes: prev.attributes.map((a, idx) =>
        idx === i ? { ...a, ...patch } : a
      ),
    }));

  const num = (s: string, fallback: number) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  /**
   * Auto-fill string for the Qty field given the three dim inputs and unit.
   * Returns `null` when no dim is positive (Qty is left alone).
   *
   * In ft mode with exactly one positive dim the result is feet-inches
   * notation (`6'2"`) so Qty mirrors the dimension the user typed instead
   * of showing the raw decimal feet behind it (`6.166667`). With multiple
   * dims (area, volume) or in m mode, Qty stays a plain decimal — there's
   * no meaningful feet-inches form of an area or volume.
   */
  const autoFillQty = (
    unit: DimensionUnit,
    l: string,
    b: string,
    h: string
  ): string | null => {
    const positives = [l, b, h]
      .map((s) => parseDimensionValue(s, unit))
      .filter((n): n is number => n !== null && n > 0);
    if (positives.length === 0) return null;
    const product = positives.reduce((a, c) => a * c, 1);
    if (unit === "ft" && positives.length === 1) {
      return formatFeetInches(product);
    }
    return String(Number(product.toFixed(6)));
  };

  /**
   * Set a dimension and — unless the user has manually edited Qty
   * in this session — auto-fill `quantity` with the product of all
   * non-blank dimensions. Blanks are skipped. Once the user manually
   * overrides Qty, `manualQty` flips and further dimension edits leave
   * Qty alone (sticky-override).
   */
  const setDimension = (
    key: "length" | "breadth" | "height",
    value: string
  ) => {
    setV((prev) => {
      const next = { ...prev, [key]: value };
      if (manualQty) return next;
      const auto = autoFillQty(
        next.dimensionUnit,
        next.length,
        next.breadth,
        next.height
      );
      if (auto !== null) next.quantity = auto;
      return next;
    });
  };

  /**
   * Flip the form's dimension unit (option b: preserve the physical
   * measurement). Empty inputs stay empty — no `0'0"` noise.
   */
  const changeFormDimensionUnit = (next: DimensionUnit) => {
    setV((prev) => {
      if (next === prev.dimensionUnit) return prev;
      const converted = convertDimensions(
        prev.length || null,
        prev.breadth || null,
        prev.height || null,
        prev.dimensionUnit,
        next
      );
      const toStr = (n: number | null, original: string): string => {
        if (n === null) return original.trim() === "" ? "" : original;
        return next === "ft" ? formatFeetInches(n) : String(n);
      };
      const updated = {
        ...prev,
        dimensionUnit: next,
        length: toStr(converted.length, prev.length),
        breadth: toStr(converted.breadth, prev.breadth),
        height: toStr(converted.height, prev.height),
      };
      if (!manualQty) {
        const auto = autoFillQty(
          next,
          updated.length,
          updated.breadth,
          updated.height
        );
        if (auto !== null) updated.quantity = auto;
      }
      return updated;
    });
  };

  /**
   * Mark Qty as user-overridden so dimension edits stop touching it —
   * but only if the typed value actually differs from what the
   * auto-compute would produce. Typing the exact auto value (e.g.
   * `1.875` when L=2.5/B=1.5/H=0.5) doesn't count as an override and
   * leaves the `(auto from L × B × H)` label visible.
   */
  const setQtyManually = (value: string) => {
    setV((prev) => ({ ...prev, quantity: value }));
    const autoValue = autoFillQty(
      v.dimensionUnit,
      v.length,
      v.breadth,
      v.height
    );
    if (autoValue === null || value.trim() !== autoValue) {
      setManualQty(true);
    }
  };

  /** True when at least one dimension is filled and Qty hasn't been manually edited. */
  const qtyAutoFilled = useMemo(() => {
    if (manualQty) return false;
    return [v.length, v.breadth, v.height].some(
      (s) => (parseDimensionValue(s, v.dimensionUnit) ?? 0) > 0
    );
  }, [manualQty, v.length, v.breadth, v.height, v.dimensionUnit]);

  // ft mode lets the auto-filled `6'2"` notation be typed/edited in the
  // Qty field; m mode stays numeric for IME hints + native validation.
  const isFeetUnit = v.dimensionUnit === "ft";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesc = v.description.trim();
    const trimmedName = v.name.trim();

    if (!trimmedDesc) {
      toast({
        title: "Description required",
        description: "Describe the line item.",
        variant: "error",
      });
      return;
    }

    // Division is mandatory on a plain add — it drives the line's per-division
    // number. An insert-between inherits the anchor's division server-side, so
    // its picker is hidden and this guard doesn't apply.
    const divisionId = v.divisionId;
    if (!isInsert && !divisionId) {
      toast({
        title: "Division required",
        description: "Pick the Division this line belongs to.",
        variant: "error",
      });
      return;
    }

    // Every line, not just the ones saved to the library. The guard narrows
    // `categoryId` to a non-null id for the two payloads below.
    const categoryId = v.categoryId;
    if (!isServiceAreaId(categoryId)) {
      toast({
        title: "Service Area required",
        description:
          "A BOQ line must sit under a Service Area — it's what matches it to rate contracts and vendors.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Reuse a suggested element (Scenario 1) or let the server auto-create one
      // (Scenario 2 — PRD 2.2). The element-detail fields ride the payload either
      // way: the server snapshots them onto the auto-created element, and ignores
      // them when a line reuses an existing `elementId`.
      const payload: CreateItemPayload = {
        boqId,
        sectionId: v.sectionId === BOQ_NO_SECTION_ID ? null : v.sectionId,
        // Omitted on insert-between (server inherits the anchor's division).
        divisionId: divisionId ?? undefined,
        elementId: linkedElement?.id,
        itemCode: linkedElement?.code,
        categoryId,
        name: trimmedName || null,
        description: trimmedDesc,
        unit: v.unit,
        currency: v.currency,
        quantity: parseDimensionValue(v.quantity, v.dimensionUnit) ?? 1,
        unitCost: num(v.unitCost, 0),
        materialCost: parseOptionalNumber(v.materialCost.trim()),
        labourCost: parseOptionalNumber(v.labourCost.trim()),
        overheadPct: num(v.overheadPct, 0),
        serviceChargePct: num(v.serviceChargePct, 0),
        marginPct: num(v.marginPct, 15),
        clientRate: parseOptionalNumber(v.clientRate.trim()),
        budgetRate: parseOptionalNumber(v.budgetRate.trim()),
        length: parseDimensionValue(v.length, v.dimensionUnit),
        breadth: parseDimensionValue(v.breadth, v.dimensionUnit),
        height: parseDimensionValue(v.height, v.dimensionUnit),
        dimensionUnit: v.dimensionUnit,
        notes: v.notes.trim() || null,
        // Element-detail snapshot for the auto-create (ignored on reuse).
        tags: v.tags,
        specReference: v.specReference.trim() || null,
        drawingRef: v.drawingRef.trim() || null,
        imageUrl: v.imageUrl,
        drawingFileUrl: v.drawingFileUrl,
        drawingFileName: v.drawingFileName,
        specFileUrl: v.specFileUrl,
        specFileName: v.specFileName,
        attributes: v.attributes.filter(
          (a) => a.attribute_key && a.attribute_value
        ),
        ...(anchorItemId
          ? { anchorItemId, insertPosition: insertPosition ?? "below" }
          : {}),
      };

      try {
        await createItem(payload);
      } catch (err) {
        // Insert hit a full section — ask before renumbering, then retry.
        if (isNeedsRenumberError(err)) {
          setRenumberPayload(payload);
          return;
        }
        throw err;
      }

      toast({
        title: linkedElement ? "Item added from library" : "Item added",
        variant: "success",
      });
      onOpenChange(false);
    } catch (err) {
      // useBoqMutations toasts on its own boq error path; toast here
      // when the failure happened during element creation.
      if (err instanceof ApiError) {
        toast({
          title: "Could not save",
          description: err.message,
          variant: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRenumber = async () => {
    if (!renumberPayload) return;
    setSubmitting(true);
    try {
      await createItem({ ...renumberPayload, allowRenumber: true });
      toast({ title: "Item inserted", variant: "success" });
      setRenumberPayload(null);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: "Could not insert",
          description: err.message,
          variant: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-assigned on save from the Service Area, like the Element Library —
  // show the same `PREFIX-••••` preview once one is picked. Gated on the tree
  // being loaded so a real Service Area never briefly previews as `GEN-••••`
  // before its prefix is known.
  const codePreview =
    treeLoaded && v.categoryId
      ? `${categoryPrefixOf(options, v.categoryId) ?? UNCATEGORIZED_PREFIX}-••••`
      : "";

  const labelCls = "text-xs font-medium text-text-secondary";
  const requiredAsterisk = (
    <span className="text-danger" aria-hidden>
      *
    </span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isInsert
              ? `Insert item ${insertPosition ?? "below"}`
              : "Add BOQ item"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <SheetBody className="flex flex-col gap-4">
            {/* Identity row: Image + (Code | Name) */}
            <div className="flex flex-col md:flex-row gap-4">
              <FileUploadSlot
                variant="image"
                label="Image"
                url={v.imageUrl}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onUploaded={({ url }) => set("imageUrl", url)}
                onCleared={() => set("imageUrl", null)}
              />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 self-start">
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Element code</span>
                  <Input
                    value={codePreview}
                    readOnly
                    disabled
                    placeholder="Auto-generated"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Name</span>
                  <Input
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={255}
                    placeholder="Short, reusable label"
                  />
                </label>
              </div>
            </div>

            {/* Division (required) | Section. Line numbers restart per division
                (DIV-10, 20, …); the section is an optional grouping under it. An
                insert-between inherits the anchor's division, so its picker is
                hidden — only the section (also anchor-derived) shows. */}
            {isInsert ? (
              <BoqSectionSelect
                value={v.sectionId}
                onChange={changeSection}
                sections={sectionsForDivision}
                projectId={projectId}
                boqId={boqId}
                nextSortOrder={sections.length}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BoqDivisionSelect
                  label="Division"
                  value={v.divisionId}
                  onChange={(id) => id && changeDivision(id)}
                  required
                />
                <BoqSectionSelect
                  value={v.sectionId}
                  onChange={changeSection}
                  sections={sectionsForDivision}
                  projectId={projectId}
                  boqId={boqId}
                  nextSortOrder={sections.length}
                />
              </div>
            )}

            {/* Required on every line, not just the ones going to the library:
                the Service Area is what makes a line match rate contracts and
                drive vendor suggestion, so an unclassified line silently gets
                neither. Lines added FROM the library inherit their element's. */}
            <ServiceAreaField
              label="Service area"
              value={v.categoryId}
              onChange={(id) => set("categoryId", id)}
              requiredHint="A BOQ line must sit under a Service Area"
              enabled={open}
            />

            {/* Description */}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Description{requiredAsterisk}</span>
              <textarea
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                required
                maxLength={500}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                placeholder="e.g. Concrete footing M25"
              />
            </label>

            {/* Master-data (PRD 2.2): reuse a matching library element instead of
                auto-creating a duplicate. Chip when linked; suggestions otherwise. */}
            {linkedElement ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                <span className="text-xs text-text-secondary min-w-0 truncate">
                  Linked to{" "}
                  <span className="font-mono text-text-primary">
                    {linkedElement.code}
                  </span>{" "}
                  · {linkedElement.name}
                </span>
                <button
                  type="button"
                  onClick={() => setLinkedElement(null)}
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-text-muted hover:text-danger"
                >
                  <X className="w-3.5 h-3.5" />
                  Unlink
                </button>
              </div>
            ) : (
              suggestions.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-bg-elevated/50 p-2">
                  <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Similar elements in the library
                  </span>
                  {suggestions.map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => reuseElement(el)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-elevated"
                    >
                      <span className="font-mono text-xs text-text-muted w-28 shrink-0 truncate">
                        {el.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-text-primary">
                        {el.description || el.name}
                      </span>
                      <span className="flex-shrink-0 text-xs text-accent">
                        Use this
                      </span>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* Unit | Currency */}
            <div className="grid grid-cols-2 gap-3">
              <UnitSelect
                label="Unit"
                value={v.unit}
                onChange={(u) => set("unit", u)}
                required
              />
              <CurrencySelect
                label="Currency"
                value={v.currency}
                onChange={(c) => set("currency", c)}
                required
              />
            </div>

            {/* Dimensions — optional, auto-fills Qty. Per-item unit (m / ft). */}
            <div className="flex flex-col gap-3 my-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  Dimensions
                </span>
                <BoqDimensionUnitToggle
                  value={v.dimensionUnit}
                  onChange={changeFormDimensionUnit}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["length", "breadth", "height"] as const).map((key) => {
                  const labelMap = {
                    length: "Length",
                    breadth: "Breadth",
                    height: "Height",
                  } as const;
                  const isFeet = v.dimensionUnit === "ft";
                  return (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className={labelCls}>{labelMap[key]}</span>
                      <Input
                        type={isFeet ? "text" : "number"}
                        inputMode={isFeet ? "text" : "decimal"}
                        min={isFeet ? undefined : "0"}
                        step={isFeet ? undefined : "any"}
                        placeholder={isFeet ? `7'10"` : "optional"}
                        value={v[key]}
                        onChange={(e) => setDimension(key, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Qty | Unit cost * | Margin % */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>
                  Qty
                  {qtyAutoFilled && (
                    <span className="ml-1.5 text-[10px] font-medium italic text-accent">
                      (auto from L × B × H)
                    </span>
                  )}
                </span>
                <Input
                  type={isFeetUnit ? "text" : "number"}
                  inputMode={isFeetUnit ? "text" : "decimal"}
                  min={isFeetUnit ? undefined : "0"}
                  step={isFeetUnit ? undefined : "any"}
                  value={v.quantity}
                  onChange={(e) => setQtyManually(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Unit cost{requiredAsterisk}</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={v.unitCost}
                  onChange={(e) => set("unitCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Margin %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.marginPct}
                  onChange={(e) => set("marginPct", e.target.value)}
                />
              </label>
            </div>

            {/* Material | Labour | Overhead % */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Material cost</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="optional"
                  value={v.materialCost}
                  onChange={(e) => set("materialCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Labour cost</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="optional"
                  value={v.labourCost}
                  onChange={(e) => set("labourCost", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Overhead %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.overheadPct}
                  onChange={(e) => set("overheadPct", e.target.value)}
                />
              </label>
            </div>

            {/* Service charge % | Client rate | Budget rate */}
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Service charge %</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.serviceChargePct}
                  onChange={(e) => set("serviceChargePct", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Client rate</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="optional"
                  value={v.clientRate}
                  onChange={(e) => set("clientRate", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Budget rate</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="optional"
                  value={v.budgetRate}
                  onChange={(e) => set("budgetRate", e.target.value)}
                />
              </label>
            </div>

            {/* Spec ref | Drawing ref */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Spec reference</span>
                <Input
                  value={v.specReference}
                  onChange={(e) => set("specReference", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. SPEC-204"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Drawing reference</span>
                <Input
                  value={v.drawingRef}
                  onChange={(e) => set("drawingRef", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. A-101 / Detail 4"
                />
              </label>
            </div>

            {/* Drawing file | Spec file */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FileUploadSlot
                variant="file"
                label="Drawing file"
                url={v.drawingFileUrl}
                fileName={v.drawingFileName}
                accept=".pdf,.dwg,.dxf,.skp,.png,.jpg,.jpeg,.webp"
                onUploaded={({ url, fileName }) => {
                  set("drawingFileUrl", url);
                  set("drawingFileName", fileName);
                }}
                onCleared={() => {
                  set("drawingFileUrl", null);
                  set("drawingFileName", null);
                }}
              />
              <FileUploadSlot
                variant="file"
                label="Spec file"
                url={v.specFileUrl}
                fileName={v.specFileName}
                accept=".pdf,.doc,.docx,.txt"
                onUploaded={({ url, fileName }) => {
                  set("specFileUrl", url);
                  set("specFileName", fileName);
                }}
                onCleared={() => {
                  set("specFileUrl", null);
                  set("specFileName", null);
                }}
              />
            </div>

            {/* Tags */}
            <TagInput
              label="Tags"
              placeholder="Add tag…"
              value={v.tags}
              onChange={(tags) => set("tags", tags)}
            />

            {/* Attributes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={labelCls}>Attributes</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addAttribute}
                >
                  <Plus className="w-4 h-4" />
                  Add attribute
                </Button>
              </div>
              {v.attributes.map((attr, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center"
                >
                  <Input
                    placeholder="key"
                    value={attr.attribute_key}
                    onChange={(e) =>
                      setAttribute(i, { attribute_key: e.target.value })
                    }
                  />
                  <Input
                    placeholder="value"
                    value={attr.attribute_value}
                    onChange={(e) =>
                      setAttribute(i, { attribute_value: e.target.value })
                    }
                  />
                  <Input
                    placeholder="unit"
                    value={attr.unit ?? ""}
                    onChange={(e) =>
                      setAttribute(i, { unit: e.target.value || undefined })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttribute(i)}
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Notes</span>
              <textarea
                value={v.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                placeholder="Internal note (not shown to client)…"
              />
            </label>
          </SheetBody>

          {/* Sticky footer. Every line links a library element: a reused
              suggestion, or one the server auto-creates on save (PRD 2.2). */}
          <div className="bg-bg-elevated border-t border-border-default">
            <div className="flex flex-row items-center justify-between gap-3 px-6 py-3">
              <span className="text-[13px] font-medium text-text-muted leading-relaxed">
                {linkedElement
                  ? `Reusing ${linkedElement.code} from the library.`
                  : "Saved to the Element Library on add."}
              </span>
              <div className="flex flex-row gap-2">
                <SheetClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </SheetClose>
                <Button type="submit" disabled={submitting}>
                  <Plus className="w-4 h-4" />
                  {submitting ? "Adding…" : "Add item"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>

      <ConfirmDialog
        open={renumberPayload !== null}
        onOpenChange={(open) => {
          if (!open) setRenumberPayload(null);
        }}
        title="No room to insert"
        description="This section has no gap left between these lines. Renumber the section to clean, evenly-spaced line numbers and insert here?"
        confirmLabel="Renumber & insert"
        submitting={submitting}
        onConfirm={confirmRenumber}
      />
    </Sheet>
  );
}
