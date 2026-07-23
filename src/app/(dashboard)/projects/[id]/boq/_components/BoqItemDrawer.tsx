"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BadgeCheck,
  FileText,
  Folder,
  History,
  Layers,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/useToast";
import { cn } from "@/lib/utils";
import { API } from "@/lib/api/routes";
import type {
  AvailableRate,
  BoqItemHistoryEvent,
  BoqItemVersion,
  BoqItemWithComputed,
  BoqSection,
  UserRole,
} from "@/types";
import {
  ServiceAreaField,
  useCategoryTree,
} from "@/components/elements/ServiceAreaField";
import type { BoqItemPhase, ElementUnit } from "@/lib/validations";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { isExternalViewer } from "@/lib/roles";
import { formatBoqLineRef } from "@/lib/boq/lineRef";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqEditableCell } from "./BoqEditableCell";
import { BoqChangeRequestBanner } from "./BoqChangeRequestBanner";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";
import { BoqDimensionUnitToggle } from "./BoqDimensionUnitToggle";
import { BoqItemActivity } from "./BoqItemActivity";
import { BoqItemChangeHistory } from "./BoqItemChangeHistory";
import { BoqDivisionSelect } from "./BoqDivisionSelect";
import { BoqSectionSelect } from "./BoqSectionSelect";
import type { UpdateItemPayload } from "@/lib/api/boq";
import {
  BOQ_NO_SECTION_ID,
  convertDimensions,
  formatCurrency,
  formatDimension,
  DEFAULT_DIMENSION_UNIT,
  formatLibraryName,
  formatOptionalCurrency,
  formatPct,
  formatQty,
  getLegalPhaseTransitions,
  isDestructivePhase,
  parseOptionalNumber,
  phaseToLabel,
  phaseToVariant,
  marginTier,
  toNum,
  type DimensionUnit,
} from "../_lib/formatters";

interface BoqItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  item: BoqItemWithComputed | null;
  sections: BoqSection[];
  currency: string;
  minimumMarginPct: string;
  canEdit: boolean;
  /** Caller's role — gates phase-transition buttons per server permission matrix. */
  role: UserRole | null;
  /** Current viewer's user id — used to derive `isCreator`. */
  currentUserId: string | null;
  /** BOQ.created_by — used to derive `isCreator` for the 4-eyes rule. */
  boqCreatorId: string | null;
  /**
   * Optional delete handler — wired up by the parent so the existing
   * ConfirmDialog flow stays the single source of truth. Drawer just
   * emits the request; parent decides whether to close + show confirm.
   */
  onDelete?: (item: BoqItemWithComputed) => void;
  /**
   * Click handler for sibling items inside the Activity tab's bulk-batch
   * popover. Parent should swap the open drawer to the clicked item.
   */
  onOpenOtherItem?: (itemId: string) => void;
}

const ACTION_LABEL: Record<BoqItemPhase, string> = {
  draft: "Move to Draft",
  internal_review: "Submit for Review",
  internal_changes_requested: "Request Changes",
  internally_approved: "Approve",
  sent_to_client: "Send to Client",
  client_reviewing: "Mark Client Reviewing",
  client_changes_requested: "Request Changes",
  client_approved: "Mark Client Approved",
  ready_for_procurement: "Mark Ready for Procurement",
};

/** Clients drop the "Mark Client" prefix — they're the client. */
const CLIENT_ACTION_LABEL: Partial<Record<BoqItemPhase, string>> = {
  client_approved: "Approve",
  client_changes_requested: "Request Changes",
};

function phaseActionLabel(
  target: BoqItemPhase,
  viewerRole: UserRole | null
): string {
  if (viewerRole === "client") {
    return CLIENT_ACTION_LABEL[target] ?? ACTION_LABEL[target];
  }
  return ACTION_LABEL[target];
}

const NOTES_TEXTAREA_CLS =
  "rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-strong focus:ring-1 focus:ring-accent/30 resize-y disabled:opacity-60";

/**
 * Editable buffer for the drawer's Details tab. Every value is held as a string
 * (matching the inline-cell edit model) except `dimensionUnit`. Nothing is
 * persisted until the user clicks Save — see the module comment on the drawer.
 */
interface DrawerDraft {
  name: string;
  description: string;
  itemCode: string;
  unit: string;
  quantity: string;
  unitCost: string;
  marginPct: string;
  overheadPct: string;
  serviceChargePct: string;
  clientRate: string;
  budgetRate: string;
  length: string;
  breadth: string;
  height: string;
  dimensionUnit: DimensionUnit;
  notes: string;
  clientNotes: string;
  /** Service-area category id ("" = unclassified). Reclassification only. */
  categoryId: string;
  /** Division id the line is filed under (mandatory; "" only before binding). */
  divisionId: string;
  /** Section id, or `BOQ_NO_SECTION_ID` for the "(Unassigned)" bucket. */
  sectionId: string;
}

/** Keys compared numerically so "18" and "18.000" don't read as a change. */
const NUMERIC_DRAFT_KEYS = new Set<keyof DrawerDraft>([
  "quantity",
  "unitCost",
  "marginPct",
  "overheadPct",
  "serviceChargePct",
  "clientRate",
  "budgetRate",
  "length",
  "breadth",
  "height",
]);

/**
 * Draft fields that are "material" — editing any of them on a client-approved
 * or ready-for-procurement item re-opens it (server flips it to
 * `sent_to_client`). Mirrors `REAPPROVAL_FIELDS` in `queries/boq.ts`, minus the
 * fields the drawer can't edit (materialCost / labourCost / sectionId). A pure
 * `dimensionUnit` flip isn't material on its own — it only reopens if it
 * actually changes a length/breadth/height value.
 */
const REOPEN_DRAFT_KEYS = new Set<keyof DrawerDraft>([
  "description",
  "unit",
  "quantity",
  "unitCost",
  "marginPct",
  "overheadPct",
  "serviceChargePct",
  "clientRate",
  "length",
  "breadth",
  "height",
]);

/** Blank buffer used before an item is bound (component early-returns anyway). */
const EMPTY_DRAFT: DrawerDraft = {
  name: "",
  description: "",
  itemCode: "",
  unit: "",
  quantity: "",
  unitCost: "",
  marginPct: "",
  overheadPct: "",
  serviceChargePct: "",
  clientRate: "",
  budgetRate: "",
  length: "",
  breadth: "",
  height: "",
  dimensionUnit: DEFAULT_DIMENSION_UNIT,
  notes: "",
  clientNotes: "",
  categoryId: "",
  divisionId: "",
  sectionId: BOQ_NO_SECTION_ID,
};

function seedDraft(item: BoqItemWithComputed): DrawerDraft {
  const resolvedName =
    item.name ??
    (item.element_name
      ? formatLibraryName(item.element_name, item.element_archived)
      : "");
  return {
    name: resolvedName,
    description: item.description,
    itemCode: item.item_code ?? "",
    unit: item.unit,
    quantity: String(item.quantity ?? ""),
    unitCost: String(item.unit_cost ?? ""),
    marginPct: String(item.margin_pct ?? ""),
    overheadPct: String(item.overhead_pct ?? ""),
    serviceChargePct: String(item.service_charge_pct ?? ""),
    clientRate: item.client_rate ?? "",
    budgetRate: item.budget_rate ?? "",
    length: item.length ?? "",
    breadth: item.breadth ?? "",
    height: item.height ?? "",
    dimensionUnit: item.dimension_unit,
    notes: item.notes ?? "",
    clientNotes: item.client_notes ?? "",
    categoryId: item.category_id ?? "",
    divisionId: item.division_id ?? "",
    sectionId: item.section_id ?? BOQ_NO_SECTION_ID,
  };
}

/** Field-aware equality so numeric formatting differences don't count as edits. */
function draftFieldEqual(
  key: keyof DrawerDraft,
  a: string,
  b: string
): boolean {
  if (NUMERIC_DRAFT_KEYS.has(key)) {
    return parseOptionalNumber(a) === parseOptionalNumber(b);
  }
  return a.trim() === b.trim();
}

/** Keys whose draft value differs from the persisted item. */
function changedDraftKeys(
  draft: DrawerDraft,
  item: BoqItemWithComputed
): (keyof DrawerDraft)[] {
  const seed = seedDraft(item);
  return (Object.keys(draft) as (keyof DrawerDraft)[]).filter((k) => {
    if (k === "dimensionUnit") return draft[k] !== seed[k];
    return !draftFieldEqual(k, draft[k] as string, seed[k] as string);
  });
}

/** Build the API patch for exactly the fields that changed. */
function buildPatch(
  draft: DrawerDraft,
  changed: (keyof DrawerDraft)[]
): Partial<UpdateItemPayload> {
  const patch: Partial<UpdateItemPayload> = {};
  for (const k of changed) {
    switch (k) {
      case "name":
        patch.name = draft.name.trim() || null;
        break;
      case "description":
        patch.description = draft.description.trim();
        break;
      case "itemCode":
        patch.itemCode = draft.itemCode.trim();
        break;
      case "unit":
        // Always on-enum: the field is a `UnitSelect`, which can only emit one.
        patch.unit = draft.unit.trim() as ElementUnit;
        break;
      case "notes":
        patch.notes = draft.notes.trim() || null;
        break;
      case "clientNotes":
        patch.clientNotes = draft.clientNotes.trim() || null;
        break;
      case "categoryId":
        // Non-nullable now: an edit may move the line to another Service Area,
        // not clear it. `dirty` only flags this field when it actually changed,
        // and Save is blocked while it's empty.
        if (draft.categoryId) patch.categoryId = draft.categoryId;
        break;
      case "divisionId":
        // Mandatory — only send a real id. Server re-flows per-division line
        // numbers on a division change.
        if (draft.divisionId) patch.divisionId = draft.divisionId;
        break;
      case "sectionId":
        patch.sectionId =
          draft.sectionId === BOQ_NO_SECTION_ID ? null : draft.sectionId;
        break;
      case "quantity":
        patch.quantity = parseFloat(draft.quantity);
        break;
      case "unitCost":
        patch.unitCost = parseFloat(draft.unitCost);
        break;
      case "marginPct":
        patch.marginPct = parseFloat(draft.marginPct);
        break;
      case "overheadPct":
        patch.overheadPct = parseFloat(draft.overheadPct);
        break;
      case "serviceChargePct":
        patch.serviceChargePct = parseFloat(draft.serviceChargePct);
        break;
      case "clientRate":
        patch.clientRate = parseOptionalNumber(draft.clientRate);
        break;
      case "budgetRate":
        patch.budgetRate = parseOptionalNumber(draft.budgetRate);
        break;
      case "length":
        patch.length = parseOptionalNumber(draft.length);
        break;
      case "breadth":
        patch.breadth = parseOptionalNumber(draft.breadth);
        break;
      case "height":
        patch.height = parseOptionalNumber(draft.height);
        break;
      case "dimensionUnit":
        patch.dimensionUnit = draft.dimensionUnit;
        break;
    }
  }
  return patch;
}

/**
 * Right-side drawer with full item detail, buffered field editing, and
 * lifecycle transitions.
 *
 * Edits are buffered locally and only persist when the user clicks **Save** —
 * there is no autosave-on-blur or save-on-close. This keeps an implicit write
 * from silently re-opening a client-approved / ready-for-procurement item, and
 * lets us warn the user before a material change does so. Closing with unsaved
 * changes prompts to discard. The main BOQ table keeps its inline autosave.
 */
export function BoqItemDrawer({
  open,
  onOpenChange,
  projectId,
  item,
  sections,
  currency,
  minimumMarginPct,
  canEdit,
  role,
  currentUserId,
  boqCreatorId,
  onDelete,
  onOpenOtherItem,
}: BoqItemDrawerProps) {
  const t = useTranslations("boq.table");
  const tRc = useTranslations("rateContracts");
  const { updateItem, setItemExcluded, setItemPhase } =
    useBoqMutations(projectId);
  const isExternal = isExternalViewer(role);
  // PR C: studio-only "rate contract available/applied" indicator. The per-item
  // rates endpoint is pm/architect only, so skip the fetch for viewers. Resolves
  // by the item's service area, so free-text lines (no element) also match.
  const { data: rateData } = useSWR<{ rates: AvailableRate[] }>(
    open && !isExternal && item && (item.element_id || item.category_id)
      ? API.boqItemRates(projectId, item.id)
      : null
  );
  // Buffered edit state. Seeded when a new item opens; NOT re-seeded on SWR
  // revalidation, so a background refresh can't clobber in-progress edits.
  const [draft, setDraft] = useState<DrawerDraft>(() =>
    item ? seedDraft(item) : EMPTY_DRAFT
  );

  // Lines predating the rule carry no Service Area (or a level-1 one). They
  // open fine; Save is what's blocked until one is chosen.
  const { isServiceAreaId, loaded: categoriesLoaded } = useCategoryTree(
    open && !isExternal
  );
  const serviceAreaChosen = isServiceAreaId(draft.categoryId || null);

  const [saving, setSaving] = useState(false);
  // RFQ-3d: in-flight state + confirm for the remove-from-scope action.
  const [excluding, setExcluding] = useState(false);
  const [showExcludeConfirm, setShowExcludeConfirm] = useState(false);
  // Deferred-close / re-approval prompts.
  const [showDiscard, setShowDiscard] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [transitioning, setTransitioning] = useState<BoqItemPhase | null>(null);
  // Carries which destructive variant was picked so the dialog submits with
  // the right phase (internal vs client kick-back).
  const [pendingDestructive, setPendingDestructive] =
    useState<BoqItemPhase | null>(null);
  const [tab, setTab] = useState<"details" | "activity">("details");
  // Activity splits into a phase Timeline and a field-change log; they're
  // distinct histories, so they live behind a sub-toggle rather than stacked.
  const [activityView, setActivityView] = useState<"timeline" | "changes">(
    "timeline"
  );
  // Counts for the sub-toggle, fetched only while the Activity tab is open. The
  // shown view's endpoint dedupes against its child component's own fetch; the
  // hidden view's is a cheap prefetch, so switching sub-tabs is instant.
  const activityOpen = open && tab === "activity";
  const { data: timelineData } = useSWR<{ events: BoqItemHistoryEvent[] }>(
    activityOpen && item ? API.boqItemHistory(projectId, item.id) : null
  );
  const { data: changesData } = useSWR<{ versions: BoqItemVersion[] }>(
    activityOpen && item ? API.boqItemVersions(projectId, item.id) : null
  );
  const timelineCount = timelineData?.events.length;
  const changesCount = changesData?.versions.length;

  // Seed the buffer only when a new drawer opens (or the item id changes).
  // Also reset to Details so opening a different item doesn't keep an
  // unrelated Activity feed in view.
  useEffect(() => {
    if (!open || !item) return;
    setDraft(seedDraft(item));
    setTab("details");
    setActivityView("timeline");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const changed = useMemo(
    () => (item ? changedDraftKeys(draft, item) : []),
    [draft, item]
  );
  const dirty = changed.length > 0;

  if (!item) return null;

  const section = sections.find((s) => s.id === item.section_id) ?? null;
  // Section picker is scoped to the division the draft currently targets — a
  // section belongs to exactly one division.
  const sectionsForDivision = sections.filter(
    (s) => s.division_id === draft.divisionId
  );
  const availableRates = rateData?.rates ?? [];
  const appliedRate = item.rate_contract_item_id
    ? availableRates.find(
        (r) => r.rate_contract_item_id === item.rate_contract_item_id
      )
    : undefined;
  const tier = marginTier(toNum(item.margin_pct), toNum(minimumMarginPct));
  const marginColor =
    tier === "success"
      ? "text-success"
      : tier === "warning"
        ? "text-warning"
        : "text-error";

  // A material edit to an approved / ready item re-opens it for the client.
  const willReopen =
    (item.phase === "client_approved" ||
      item.phase === "ready_for_procurement") &&
    changed.some((k) => REOPEN_DRAFT_KEYS.has(k));

  const setField = (patch: Partial<DrawerDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  /**
   * Buffer a dimension change and re-run L × B × H into `quantity` so the line
   * stays in sync (mirrors the create-sheet behaviour). Blank dimensions are
   * skipped from the product. Purely local — persisted on Save.
   */
  const setDimension = (key: "length" | "breadth" | "height", next: string) => {
    const dims: Record<"length" | "breadth" | "height", number | null> = {
      length: parseOptionalNumber(draft.length),
      breadth: parseOptionalNumber(draft.breadth),
      height: parseOptionalNumber(draft.height),
    };
    dims[key] = parseOptionalNumber(next);
    const positives = Object.values(dims).filter(
      (n): n is number => n != null && Number.isFinite(n) && n > 0
    );
    const patch: Partial<DrawerDraft> = { [key]: next };
    if (positives.length > 0) {
      patch.quantity = String(
        Number(positives.reduce((a, b) => a * b, 1).toFixed(6))
      );
    }
    setField(patch);
  };

  /**
   * Flip the per-item dimension unit in the buffer, preserving the physical
   * measurement. `quantity` only follows the new-unit product when the current
   * qty is still the L×B×H auto-fill (don't silently rewrite a manual qty).
   */
  const setDimensionUnit = (next: DimensionUnit) => {
    if (next === draft.dimensionUnit) return;
    const conv = convertDimensions(
      draft.length,
      draft.breadth,
      draft.height,
      draft.dimensionUnit,
      next
    );
    const patch: Partial<DrawerDraft> = {
      dimensionUnit: next,
      length: conv.length === null ? "" : String(conv.length),
      breadth: conv.breadth === null ? "" : String(conv.breadth),
      height: conv.height === null ? "" : String(conv.height),
    };
    const preFlipPositives = [draft.length, draft.breadth, draft.height]
      .map((s) => parseOptionalNumber(s))
      .filter((n): n is number => n !== null && n > 0);
    const preFlipAuto =
      preFlipPositives.length > 0
        ? preFlipPositives.reduce((a, b) => a * b, 1)
        : null;
    const qtyWasAutoFilled =
      preFlipAuto !== null &&
      Math.abs(toNum(draft.quantity) - preFlipAuto) < 1e-3;
    if (qtyWasAutoFilled && conv.quantity !== null) {
      patch.quantity = String(conv.quantity);
    }
    setField(patch);
  };

  const persist = async () => {
    setSaving(true);
    let result: BoqItemWithComputed | null | undefined;
    try {
      result = await updateItem(item.id, {
        updatedAt: item.updated_at,
        ...buildPatch(draft, changed),
      });
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowReopen(false);
    // 409 → `updateItem` returned null after refetching; keep the buffer so
    // the user can retry against the refreshed row instead of losing edits.
    if (result === null || result === undefined) return;
    setDraft(seedDraft(result));
    toast({ title: "Changes saved", variant: "success" });
  };

  const handleSave = () => {
    if (!dirty || saving) return;
    if (willReopen) {
      setShowReopen(true);
      return;
    }
    void persist();
  };

  // RFQ-3d: toggle the item in/out of scope (is_excluded). A non-destructive
  // alternative to deleting an item that's on an RFQ — the RFQ surfaces the
  // removal and routes it to a revision.
  const doToggleExclude = async () => {
    const removing = !item.is_excluded;
    setExcluding(true);
    try {
      const res = await setItemExcluded(item, removing);
      if (res === null || res === undefined) return; // 409 handled by the hook
      toast({
        title: removing ? "Removed from scope" : "Restored to scope",
        variant: "success",
      });
    } finally {
      setExcluding(false);
      setShowExcludeConfirm(false);
    }
  };

  const handleToggleExclude = () => {
    if (excluding || dirty) return;
    // Removing an item that's on a live RFQ has downstream impact (it shows as
    // removed on the RFQ) — confirm first. `on_rfq` (not po_status) is the right
    // signal: draft-RFQ items keep po_status='none'. Restoring is quiet.
    if (!item.is_excluded && item.on_rfq) {
      setShowExcludeConfirm(true);
      return;
    }
    void doToggleExclude();
  };

  const fireTransition = async (next: BoqItemPhase, comment?: string) => {
    setTransitioning(next);
    try {
      await setItemPhase(item.id, next, comment ? { comment } : undefined);
      toast({
        title: `Marked ${phaseToLabel(next, role)}`,
        variant: "success",
      });
    } finally {
      setTransitioning(null);
    }
  };

  const handleTransition = (next: BoqItemPhase) => {
    if (isDestructivePhase(next)) {
      setPendingDestructive(next);
      return;
    }
    void fireTransition(next);
  };

  /**
   * Funnels every close intent (Escape, overlay, X, footer Close). With unsaved
   * edits we prompt to discard instead of silently dropping — or silently
   * saving — them.
   */
  const handleSheetOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (saving) return;
    if (dirty) {
      setShowDiscard(true);
      return;
    }
    onOpenChange(false);
  };

  const fieldsDisabled = !canEdit || saving;

  // Show only transitions the viewer's role can actually fire — surfaces
  // Mark Client Approved to clients even though `canEdit` is false for them.
  const allowedNext = getLegalPhaseTransitions(item.phase, {
    role,
    actorId: currentUserId,
    boqCreatorId,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent>
          <SheetHeader>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-text-muted">
              {formatBoqLineRef(item.division_code, item.line_number)}
              {item.item_code && <span>· {item.item_code}</span>}
              {item.division_name && (
                <span className="inline-flex items-center gap-1">
                  <Layers
                    className="h-3 w-3 shrink-0 text-accent-strong"
                    aria-hidden
                  />
                  {item.division_name}
                </span>
              )}
              {section && (
                <span className="inline-flex items-center gap-1">
                  <Folder className="h-3 w-3 shrink-0" aria-hidden />
                  {section.title}
                </span>
              )}
            </div>
            <SheetTitle>{item.description}</SheetTitle>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <SheetDescription>
                {formatQty(item.quantity)} {item.unit} ·{" "}
                {formatCurrency(item.sell_price, currency)}
              </SheetDescription>
              <Badge variant={phaseToVariant(item.phase, role)}>
                {phaseToLabel(item.phase, role)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5 empty:hidden">
              {item.is_provisional && (
                <Badge variant="warning">provisional</Badge>
              )}
              {item.is_excluded && <Badge variant="archived">excluded</Badge>}
              {item.margin_alert && (
                <Badge variant="error" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> margin below floor
                </Badge>
              )}
              {item.over_budget && (
                <Badge variant="error" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.budget_variance_pct !== null
                    ? `${item.budget_variance_pct}% over budget`
                    : "over budget"}
                </Badge>
              )}
              {!isExternal &&
                (item.rate_contract_item_id ? (
                  <Badge variant="info" className="gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {appliedRate
                      ? tRc("drawerApplied", {
                          vendor: appliedRate.vendor_name,
                        })
                      : tRc("drawerAppliedGeneric")}
                  </Badge>
                ) : availableRates.length > 0 ? (
                  <Badge variant="info" className="gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {tRc("drawerAvailable")}
                  </Badge>
                ) : null)}
            </div>
          </SheetHeader>

          <div
            role="tablist"
            aria-label="Item view"
            className="flex gap-1 px-5 -mt-1 border-b border-border-default"
          >
            <DrawerTab
              icon={FileText}
              label="Details"
              active={tab === "details"}
              onClick={() => setTab("details")}
            />
            <DrawerTab
              icon={History}
              label="Activity"
              active={tab === "activity"}
              onClick={() => setTab("activity")}
            />
          </div>

          <SheetBody
            className={cn(
              "flex flex-col gap-4",
              tab === "activity" && "hidden"
            )}
          >
            {isDestructivePhase(item.phase) && (
              <BoqChangeRequestBanner projectId={projectId} itemId={item.id} />
            )}
            <DrawerCard title="Identity">
              <EditableField
                label="Name"
                disabled={fieldsDisabled}
                value={draft.name}
                display={draft.name || "—"}
                onSave={(next) => setField({ name: next })}
                placeholder="Short, reusable label"
              />
              <EditableField
                label="Description"
                disabled={fieldsDisabled}
                value={draft.description}
                display={draft.description}
                onSave={(next) => setField({ description: next })}
              />
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label="Element code"
                  disabled={fieldsDisabled}
                  value={draft.itemCode}
                  display={draft.itemCode || "—"}
                  onSave={(next) => setField({ itemCode: next })}
                  inputClassName="font-mono"
                />
                <UnitSelect
                  label="Unit"
                  disabled={fieldsDisabled}
                  value={draft.unit as ElementUnit}
                  onChange={(next) => setField({ unit: next })}
                />
              </div>
              {!isExternal && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-secondary">
                    {tRc("colServiceArea")}
                  </span>
                  {fieldsDisabled ? (
                    <span className="text-sm text-text-primary">
                      {item.category_name ?? "—"}
                    </span>
                  ) : (
                    <ServiceAreaField
                      value={draft.categoryId || null}
                      onChange={(id) => setField({ categoryId: id ?? "" })}
                      requiredHint={tRc("serviceAreaRequiredLine")}
                    />
                  )}
                </div>
              )}
              {!isExternal && (
                <div className="grid grid-cols-2 gap-3">
                  {fieldsDisabled ? (
                    <>
                      <DetailField
                        label="Division"
                        value={item.division_name ?? "—"}
                      />
                      <DetailField
                        label="Section"
                        value={section?.title ?? "(Unassigned)"}
                      />
                    </>
                  ) : (
                    <>
                      <BoqDivisionSelect
                        label="Division"
                        required
                        value={draft.divisionId || null}
                        onChange={(id) => {
                          const nextDivision = id ?? "";
                          // A section belongs to one division — drop it if it no
                          // longer matches the newly-chosen division.
                          const keepSection =
                            draft.sectionId !== BOQ_NO_SECTION_ID &&
                            sections.some(
                              (s) =>
                                s.id === draft.sectionId &&
                                s.division_id === nextDivision
                            );
                          setField({
                            divisionId: nextDivision,
                            sectionId: keepSection
                              ? draft.sectionId
                              : BOQ_NO_SECTION_ID,
                          });
                        }}
                      />
                      <BoqSectionSelect
                        label="Section"
                        value={draft.sectionId}
                        onChange={(next) => setField({ sectionId: next })}
                        sections={sectionsForDivision}
                      />
                    </>
                  )}
                </div>
              )}
            </DrawerCard>

            <DrawerCard title="Pricing">
              <div
                className={cn(
                  "grid gap-2",
                  isExternal ? "grid-cols-1" : "grid-cols-2"
                )}
              >
                <StatBlock
                  label={isExternal ? t("totalLabel") : t("fieldProposedPrice")}
                  value={formatCurrency(item.sell_price, currency)}
                />
                {!isExternal && (
                  <StatBlock
                    label="Total cost"
                    value={formatCurrency(item.total_cost, currency)}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <EditableField
                  label="Quantity"
                  disabled={fieldsDisabled}
                  mode="number"
                  min={0}
                  value={draft.quantity}
                  display={formatQty(draft.quantity)}
                  onSave={(next) => setField({ quantity: next })}
                />
                {!isExternal && (
                  <>
                    <EditableField
                      label="Unit cost"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      value={draft.unitCost}
                      display={formatCurrency(draft.unitCost, currency)}
                      onSave={(next) => setField({ unitCost: next })}
                    />
                    <EditableField
                      label="Margin"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      max={100}
                      value={draft.marginPct}
                      display={formatPct(draft.marginPct)}
                      valueClassName={marginColor}
                      onSave={(next) => setField({ marginPct: next })}
                    />
                    <EditableField
                      label="Overhead"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      max={100}
                      value={draft.overheadPct}
                      display={formatPct(draft.overheadPct)}
                      onSave={(next) => setField({ overheadPct: next })}
                    />
                    <EditableField
                      label="Service charge"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      max={100}
                      value={draft.serviceChargePct}
                      display={formatPct(draft.serviceChargePct)}
                      onSave={(next) => setField({ serviceChargePct: next })}
                    />
                    <EditableField
                      label="Client rate"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      value={draft.clientRate}
                      display={formatOptionalCurrency(
                        draft.clientRate === "" ? null : draft.clientRate,
                        currency
                      )}
                      onSave={(next) => setField({ clientRate: next })}
                    />
                    <EditableField
                      label="Budget rate"
                      disabled={fieldsDisabled}
                      mode="number"
                      min={0}
                      value={draft.budgetRate}
                      display={formatOptionalCurrency(
                        draft.budgetRate === "" ? null : draft.budgetRate,
                        currency
                      )}
                      onSave={(next) => setField({ budgetRate: next })}
                    />
                  </>
                )}
              </div>
            </DrawerCard>

            <DrawerCard
              title="Dimensions"
              action={
                <BoqDimensionUnitToggle
                  value={draft.dimensionUnit}
                  disabled={fieldsDisabled}
                  onChange={setDimensionUnit}
                />
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <EditableField
                  label="Length"
                  disabled={fieldsDisabled}
                  mode={draft.dimensionUnit === "ft" ? "feet-inches" : "number"}
                  min={0}
                  value={draft.length}
                  display={formatDimension(draft.length, draft.dimensionUnit)}
                  onSave={(next) => setDimension("length", next)}
                />
                <EditableField
                  label="Breadth"
                  disabled={fieldsDisabled}
                  mode={draft.dimensionUnit === "ft" ? "feet-inches" : "number"}
                  min={0}
                  value={draft.breadth}
                  display={formatDimension(draft.breadth, draft.dimensionUnit)}
                  onSave={(next) => setDimension("breadth", next)}
                />
                <EditableField
                  label="Height"
                  disabled={fieldsDisabled}
                  mode={draft.dimensionUnit === "ft" ? "feet-inches" : "number"}
                  min={0}
                  value={draft.height}
                  display={formatDimension(draft.height, draft.dimensionUnit)}
                  onSave={(next) => setDimension("height", next)}
                />
              </div>
            </DrawerCard>

            <DrawerCard title="Notes">
              {!isExternal && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Internal notes
                  </span>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setField({ notes: e.target.value })}
                    disabled={fieldsDisabled}
                    rows={3}
                    className={NOTES_TEXTAREA_CLS}
                    placeholder="Not shown to the client."
                  />
                </label>
              )}
              {/* External viewers see this read-only; feedback flows through
                  the change-request comment, not by editing this field. */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">
                  {isExternal ? "Notes from the team" : "Client notes"}
                </span>
                <textarea
                  value={draft.clientNotes}
                  onChange={(e) => setField({ clientNotes: e.target.value })}
                  disabled={!canEdit}
                  rows={3}
                  className={NOTES_TEXTAREA_CLS}
                  placeholder={
                    isExternal
                      ? "No notes from the team for this line."
                      : "Shown to the client on this line."
                  }
                />
              </label>
            </DrawerCard>

            {allowedNext.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Lifecycle
                </span>
                <div className="flex flex-wrap gap-2">
                  {allowedNext.map((next) => (
                    <Button
                      key={next}
                      type="button"
                      variant={
                        isDestructivePhase(next) ? "danger" : "secondary"
                      }
                      size="sm"
                      disabled={transitioning !== null || dirty}
                      onClick={() => handleTransition(next)}
                    >
                      {transitioning === next
                        ? "Working..."
                        : phaseActionLabel(next, role)}
                    </Button>
                  ))}
                </div>
                {dirty && (
                  <p className="text-xs text-text-muted">
                    Save or discard your edits to change the item&apos;s status.
                  </p>
                )}
              </section>
            )}

            {/* RFQ-3d: remove from / restore to scope. Non-destructive — the
                line stays for history but drops out of totals, and any RFQ it's
                on flags it as removed. */}
            {canEdit && (
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Scope
                </span>
                <div>
                  <Button
                    type="button"
                    variant={item.is_excluded ? "secondary" : "danger"}
                    size="sm"
                    disabled={excluding || dirty}
                    onClick={handleToggleExclude}
                  >
                    {excluding
                      ? "Working..."
                      : item.is_excluded
                        ? "Restore to scope"
                        : "Remove from scope"}
                  </Button>
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-3 text-xs text-text-muted">
              <span>Created {new Date(item.created_at).toLocaleString()}</span>
              <span>Updated {new Date(item.updated_at).toLocaleString()}</span>
            </section>
          </SheetBody>

          {tab === "activity" && (
            <SheetBody>
              <Tabs
                value={activityView}
                onValueChange={(v) =>
                  setActivityView(v as "timeline" | "changes")
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="timeline" className="flex-1 gap-1.5">
                    Timeline
                    {timelineCount != null && (
                      <ActivityCount n={timelineCount} />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="changes" className="flex-1 gap-1.5">
                    Changes
                    {changesCount != null && <ActivityCount n={changesCount} />}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                  <BoqItemActivity
                    projectId={projectId}
                    itemId={item.id}
                    viewerRole={role}
                    onOpenOtherItem={onOpenOtherItem}
                  />
                </TabsContent>
                <TabsContent value="changes">
                  <BoqItemChangeHistory
                    projectId={projectId}
                    itemId={item.id}
                  />
                </TabsContent>
              </Tabs>
            </SheetBody>
          )}

          <SheetFooter className="!justify-between">
            {canEdit && onDelete ? (
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => handleSheetOpenChange(false)}
              >
                Close
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  disabled={
                    !dirty || saving || (categoriesLoaded && !serviceAreaChosen)
                  }
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BoqChangeRequestDialog
        open={pendingDestructive !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDestructive(null);
        }}
        onSubmit={(comment) => {
          if (pendingDestructive) {
            void fireTransition(pendingDestructive, comment);
          }
          setPendingDestructive(null);
        }}
      />

      <ConfirmDialog
        open={showExcludeConfirm}
        onOpenChange={(next) => {
          if (!next) setShowExcludeConfirm(false);
        }}
        title="Remove this item from scope?"
        description="This item is on an RFQ. Removing it keeps the line for history but flags it as removed on the RFQ, where you can raise a revision to drop it."
        confirmLabel="Remove from scope"
        destructive
        submitting={excluding}
        onConfirm={doToggleExclude}
      />

      <ConfirmDialog
        open={showReopen}
        onOpenChange={(next) => {
          if (!next) setShowReopen(false);
        }}
        title="Re-open this item for the client?"
        description={
          <>
            You changed a priced or scope field on an approved item. Saving
            moves it back to{" "}
            <span className="font-semibold text-text-primary">
              “Sent to Client”
            </span>{" "}
            so the client re-approves the new value.
          </>
        }
        confirmLabel="Save & re-open"
        submitting={saving}
        onConfirm={persist}
      />

      <ConfirmDialog
        open={showDiscard}
        onOpenChange={(next) => {
          if (!next) setShowDiscard(false);
        }}
        title="Discard unsaved changes?"
        description="You have edits that haven’t been saved. Closing now will discard them."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setShowDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function DrawerTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-[3px] -mb-px transition-colors cursor-pointer",
        active
          ? "border-accent-strong text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function DetailField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span
        className={`text-sm tabular-nums text-text-primary ${valueClassName ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}

type EditableFieldProps = {
  label: string;
  valueClassName?: string;
} & Omit<
  React.ComponentProps<typeof BoqEditableCell>,
  "ariaLabel" | "className"
>;

/**
 * Inline-editable label + cell. In the drawer the cell's `onSave` writes into
 * the local edit buffer (not the API) — the drawer's Save button flushes the
 * buffer in one PATCH. `BoqEditableCell` still validates/normalises the value
 * and no-ops an unchanged commit before it reaches the buffer.
 */
function EditableField({
  label,
  valueClassName,
  ...cellProps
}: EditableFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <BoqEditableCell
        {...cellProps}
        ariaLabel={label}
        className={`text-sm tabular-nums text-text-primary ${valueClassName ?? ""}`}
      />
    </div>
  );
}

/**
 * Titled card that groups a set of related drawer fields. The Details tab is a
 * long list of same-weight fields otherwise; chunking them into cards gives the
 * eye a structure to land on. `action` renders on the right of the title row
 * (e.g. the dimension unit toggle).
 */
function DrawerCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border-default bg-bg-elevated/40 p-3.5",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Large read-only figure — the two computed totals that lead the Pricing card. */
function StatBlock({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-bg-input/60 px-3 py-2">
      <span className="truncate text-[10px] uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-base font-semibold tabular-nums text-text-primary",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Count pill shown next to an Activity sub-tab label. */
function ActivityCount({ n }: { n: number }) {
  return (
    <span className="rounded bg-bg-input px-1 text-[10px] tabular-nums text-text-muted">
      {n}
    </span>
  );
}
