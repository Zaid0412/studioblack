"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/useToast";
import { ApiError } from "@/lib/api/client";
import { elementCategories as categoriesApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type {
  CategoryImportDelete,
  CategoryImportPlan,
  CategoryParseResponse,
  CategoryPath,
} from "@/lib/api/element-categories";
import { joinCategoryPath } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { categoryKey } from "@/lib/excel/categoryPaths";
import {
  CATEGORY_CODE_MAX,
  codeSegmentOf,
  composeCategoryCode,
  normalizeCodeSegment,
} from "@/lib/categoryCode";
import { CATEGORY_IMPORT_MAX_BYTES } from "@/lib/validations";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "added" | "updated" | "removed";

/** A view that fades/slides in when it mounts, so a step change isn't a jump. */
const ENTER =
  "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none";

/**
 * Track a box's own height so a wrapper can transition to it. The tabs render
 * lists of different lengths, so the dialog jumped between them — measuring the
 * active panel and animating a fixed-height wrapper to it smooths the swap.
 *
 * A callback ref, not a stored one: the measured node is remounted whenever the
 * view changes (it lives behind a keyed wrapper), and the observer has to follow
 * it there rather than cling to a node that's been detached.
 */
function useAutoHeight<T extends HTMLElement>() {
  const [height, setHeight] = useState<number>();
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const ro = new ResizeObserver(() => setHeight(node.offsetHeight));
    ro.observe(node);
    observer.current = ro;
    setHeight(node.offsetHeight);
  }, []);
  return { ref, height };
}

/** A removal is off the table if the user kept it, or if it can't go at all. */
const isBlocked = (d: CategoryImportDelete) =>
  d.references.elements +
    d.references.vendorTrades +
    d.references.boqItems +
    d.references.rfqItems +
    d.references.rateContracts +
    d.references.rateContractItems >
  0;

/**
 * Import the category taxonomy from a spreadsheet.
 *
 * The import is a diff, not a replacement — see `planCategoryImport`. The
 * preview lays that diff out in full: what's added, what's updated, what's
 * removed. Codes stay editable here (the sheet's segment, recomposed live down
 * the path), and any removal can be kept — a category still in use is kept for
 * you and can't be dropped, so the import never has to be refused whole.
 */
export function CategoryImportDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parse, setParse] = useState<CategoryParseResponse | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    deleted: number;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("added");

  /** Edited code segments, keyed by node path. Cascades to descendants' codes. */
  const [codeEdits, setCodeEdits] = useState<Record<string, string>>({});
  /** Removals the user chose to keep. Blocked ones are always effectively kept. */
  const [kept, setKept] = useState<Set<string>>(new Set());
  /**
   * Set only by a 409: the server re-plans under its own transaction, so a race
   * can block a removal the preview thought was free.
   */
  const [serverBlocked, setServerBlocked] = useState<
    CategoryImportDelete[] | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panel = useAutoHeight<HTMLDivElement>();
  // The dialog stays mounted across close, so a slow parse could resolve after
  // a reset and repopulate a closed dialog. Each upload gets a fresh token;
  // reset invalidates any in-flight one.
  const requestToken = useRef<object>({});

  const reset = () => {
    requestToken.current = {};
    setBusy(false);
    setParse(null);
    setResult(null);
    setCodeEdits({});
    setKept(new Set());
    setServerBlocked(null);
    setTab("added");
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const plan: CategoryImportPlan | null = parse?.plan ?? null;
  const rowErrors = parse?.rows.filter((r) => r.status === "error") ?? [];

  // The removals to reason about. A 409 means the server blocked one the preview
  // thought was free (a concurrent write in between); fold its real reference
  // counts in, so `effectivelyKept` force-keeps it and it isn't sent for
  // deletion again — otherwise the retry would resend the same payload and loop.
  const deletes = useMemo(() => {
    if (!plan) return [];
    if (!serverBlocked?.length) return plan.deletes;
    const raced = new Map(serverBlocked.map((d) => [d.id, d]));
    return plan.deletes.map((d) => raced.get(d.id) ?? d);
  }, [plan, serverBlocked]);

  // Every node named in the sheet, with the code segment it arrived with — the
  // base an edit overrides, and what lets a parent's edit recompose its
  // children's codes.
  const baseSegments = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of parse?.rows ?? []) {
      if (!row.parsed) continue;
      let parentComposed: string | null = null;
      const acc: string[] = [];
      for (const node of row.parsed.path) {
        acc.push(node.name);
        const key = categoryKey(acc);
        if (!m.has(key)) {
          m.set(key, codeSegmentOf(node.codePrefix ?? "", parentComposed));
        }
        parentComposed = node.codePrefix ?? null;
      }
    }
    return m;
  }, [parse]);

  const effectiveSegment = (key: string) =>
    codeEdits[key] ?? baseSegments.get(key) ?? "";

  /** Recompose a path from the segments in play, one entry per rung. */
  const recompose = (
    names: string[]
  ): { name: string; codePrefix: string | null; error: string | null }[] => {
    const out: {
      name: string;
      codePrefix: string | null;
      error: string | null;
    }[] = [];
    let parent: string | null = null;
    const acc: string[] = [];
    for (const name of names) {
      acc.push(name);
      const raw = effectiveSegment(categoryKey(acc));
      const seg = normalizeCodeSegment(raw);
      let codePrefix: string | null = null;
      let error: string | null = null;
      if (raw.trim() && !seg) {
        error = t("categoryImportCodeInvalid");
      } else if (seg) {
        codePrefix = composeCategoryCode(parent, seg);
        if (codePrefix.length > CATEGORY_CODE_MAX) {
          error = t("categoryImportCodeTooLong", { max: CATEGORY_CODE_MAX });
        }
      }
      out.push({ name, codePrefix, error });
      parent = codePrefix;
    }
    return out;
  };

  /** The leaf's composed code + any error, for one create/update row. */
  const codeFor = (path: string[]) => recompose(path)[path.length - 1];

  const effectivelyKept = (d: CategoryImportDelete) =>
    kept.has(d.id) || isBlocked(d);

  const removedCount = deletes.filter((d) => !effectivelyKept(d)).length;

  const hasInvalidCode =
    !!plan &&
    [...plan.creates, ...plan.updates].some((c) => codeFor(c.path).error);

  // Whether the import would do anything right now — after keeps are applied.
  const hasChanges =
    !!plan &&
    (plan.creates.length > 0 || plan.updates.length > 0 || removedCount > 0);

  // Whether the sheet was a no-op to begin with. Kept over `hasChanges` for the
  // empty-state check so that keeping the last removal disables the button
  // rather than yanking the whole preview out from under the user.
  const planIsEmpty =
    !!plan &&
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0;

  const noChanges = planIsEmpty && rowErrors.length === 0;
  const canImport =
    !!plan && rowErrors.length === 0 && !hasInvalidCode && hasChanges;

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > CATEGORY_IMPORT_MAX_BYTES) {
      toast({ title: t("categoryImportTooLarge"), variant: "error" });
      return;
    }
    const token = (requestToken.current = {});
    setBusy(true);
    try {
      const parsed = await categoriesApi.validateImport(file);
      // Bail if the dialog was reset/closed while we were parsing.
      if (requestToken.current !== token) return;
      setParse(parsed);
      setCodeEdits({});
      setKept(new Set());
      setServerBlocked(null);
      // Land on the tab that has something in it.
      const p = parsed.plan;
      setTab(
        p && p.creates.length === 0 && p.updates.length > 0
          ? "updated"
          : p && p.creates.length === 0 && p.deletes.length > 0
            ? "removed"
            : "added"
      );
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t("categoryImportFailed"),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  /** The full desired tree: the sheet with edits, plus every kept removal. */
  const buildPaths = (): CategoryPath[] => {
    const paths: CategoryPath[] = [];
    for (const row of parse?.rows ?? []) {
      if (!row.parsed) continue;
      paths.push(
        recompose(row.parsed.path.map((n) => n.name)).map(
          ({ name, codePrefix }) => ({ name, codePrefix })
        )
      );
    }
    for (const d of deletes) {
      if (!effectivelyKept(d)) continue;
      // A kept removal's ancestors may be in the sheet (edited) or not (use the
      // code it already had). Prefer the sheet's, fall back to the stored one.
      const acc: string[] = [];
      paths.push(
        d.chain.map((node) => {
          acc.push(node.name);
          const key = categoryKey(acc);
          const codePrefix = baseSegments.has(key)
            ? (codeFor([...acc]).codePrefix ?? null)
            : node.codePrefix;
          return { name: node.name, codePrefix };
        })
      );
    }
    return paths;
  };

  const confirm = async () => {
    const paths = buildPaths();
    if (!paths.length) return;
    setBusy(true);
    try {
      const res = await categoriesApi.confirmImport(paths);
      setResult(res);
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryImportDone") });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.details as { blocked?: CategoryImportDelete[] } | null;
        setServerBlocked(body?.blocked ?? []);
        setTab("removed");
        toast({ title: t("categoryImportRaceBlocked"), variant: "error" });
        return;
      }
      toast({
        title: err instanceof Error ? err.message : t("categoryImportFailed"),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const view = result
    ? "result"
    : busy
      ? "busy"
      : !parse
        ? "upload"
        : rowErrors.length > 0
          ? "errors"
          : noChanges
            ? "empty"
            : "preview";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("categoryImportTitle")}</DialogTitle>
          <DialogDescription>{t("categoryImportSubtitle")}</DialogDescription>
        </DialogHeader>

        {/* Keyed on the view so each step change (esp. "choose another file" →
            upload) fades in, rather than snapping. Edits keep the same key, so
            typing a code doesn't remount the preview. */}
        <div key={view} className={ENTER}>
          {result ? (
            <ResultView
              result={result}
              onClose={() => close(false)}
              closeLabel={tCommon("close")}
              t={t}
            />
          ) : busy ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
              <p className="text-sm text-text-secondary">
                {tCommon("loading")}
              </p>
            </div>
          ) : !parse ? (
            <UploadView
              dragOver={dragOver}
              setDragOver={setDragOver}
              fileInputRef={fileInputRef}
              onFiles={handleFile}
              templateHref={categoriesApi.downloadImportTemplate()}
              t={t}
            />
          ) : rowErrors.length > 0 ? (
            <div className="flex flex-col gap-4">
              <Banner tone="error" title={t("categoryImportRowErrors")}>
                <ul className="flex flex-col gap-1">
                  {rowErrors.slice(0, 10).map((row) => (
                    <li key={row.rowNumber}>
                      <span className="font-medium">
                        {t("categoryImportRowLabel", {
                          row: row.excelRowNumber,
                        })}
                      </span>{" "}
                      — {row.errors.join("; ")}
                    </li>
                  ))}
                </ul>
              </Banner>
              <Footer onBack={reset} t={t}>
                <span />
              </Footer>
            </div>
          ) : noChanges ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-success" />}
              title={t("categoryImportNoChangesTitle")}
              body={t("categoryImportNoChangesBody")}
              action={
                <Button type="button" variant="secondary" onClick={reset}>
                  {t("categoryImportChooseAnother")}
                </Button>
              }
            />
          ) : (
            plan && (
              <div className="flex flex-col gap-4">
                <SummaryChips
                  added={plan.creates.length}
                  updated={plan.updates.length}
                  removed={removedCount}
                  t={t}
                />

                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(v as Tab)}
                  className="flex flex-col gap-3"
                >
                  <TabsList>
                    <TabsTrigger value="added" disabled={!plan.creates.length}>
                      {t("categoryImportCreated")} ({plan.creates.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="updated"
                      disabled={!plan.updates.length}
                    >
                      {t("categoryImportUpdated")} ({plan.updates.length})
                    </TabsTrigger>
                    <TabsTrigger value="removed" disabled={!deletes.length}>
                      {t("categoryImportDeleted")} ({deletes.length})
                    </TabsTrigger>
                  </TabsList>

                  <div
                    style={panel.height ? { height: panel.height } : undefined}
                    className="overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none"
                  >
                    <div
                      ref={panel.ref}
                      className="max-h-[45vh] overflow-y-auto pr-1"
                    >
                      <TabsContent value="added">
                        <RowList>
                          {plan.creates.map((c) => (
                            <CodeRow
                              key={categoryKey(c.path)}
                              tone="added"
                              path={c.path}
                              segment={effectiveSegment(categoryKey(c.path))}
                              composed={codeFor(c.path)}
                              onSegment={(v) =>
                                setCodeEdits((e) => ({
                                  ...e,
                                  [categoryKey(c.path)]: v,
                                }))
                              }
                              t={t}
                            />
                          ))}
                        </RowList>
                      </TabsContent>

                      <TabsContent value="updated">
                        <RowList>
                          {plan.updates.map((u) => (
                            <CodeRow
                              key={categoryKey(u.path)}
                              tone="updated"
                              path={u.path}
                              segment={effectiveSegment(categoryKey(u.path))}
                              composed={codeFor(u.path)}
                              previous={u.previousCodePrefix}
                              onSegment={(v) =>
                                setCodeEdits((e) => ({
                                  ...e,
                                  [categoryKey(u.path)]: v,
                                }))
                              }
                              t={t}
                            />
                          ))}
                        </RowList>
                      </TabsContent>

                      <TabsContent value="removed">
                        <RowList>
                          {deletes.map((d) => (
                            <RemovalRow
                              key={d.id}
                              delete={d}
                              blocked={isBlocked(d)}
                              kept={effectivelyKept(d)}
                              onKeep={(keep) =>
                                setKept((s) => {
                                  const next = new Set(s);
                                  if (keep) next.add(d.id);
                                  else next.delete(d.id);
                                  return next;
                                })
                              }
                              t={t}
                            />
                          ))}
                        </RowList>
                      </TabsContent>
                    </div>
                  </div>
                </Tabs>

                <p className="flex items-start gap-1.5 text-xs text-text-muted">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t("categoryImportCodeNote")}
                </p>

                <Footer onBack={reset} t={t}>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={confirm}
                    disabled={!canImport}
                  >
                    {t("categoryImportConfirmCount")}
                  </Button>
                </Footer>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── sub-views ─────────────────────────────────────────────────────────── */

type T = ReturnType<typeof useTranslations>;

function UploadView({
  dragOver,
  setDragOver,
  fileInputRef,
  onFiles,
  templateHref,
  t,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList | null) => void;
  templateHref: string;
  t: T;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          dragOver
            ? "border-accent bg-accent/10"
            : "border-border-default hover:border-border-light"
        )}
      >
        <FileSpreadsheet className="h-8 w-8 text-text-secondary" />
        <p className="text-sm text-text-secondary">
          {t("categoryImportDropzone")}
        </p>
        <p className="text-xs text-text-muted">{t("categoryImportMaxSize")}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-text-muted">
        {t("categoryImportTemplateHint")}{" "}
        <a href={templateHref} className="text-accent hover:underline">
          {t("categoryImportDownloadCurrent")}
        </a>
      </p>
    </div>
  );
}

function SummaryChips({
  added,
  updated,
  removed,
  t,
}: {
  added: number;
  updated: number;
  removed: number;
  t: T;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        tone="added"
        icon={<Plus className="h-3.5 w-3.5" />}
        value={added}
        label={t("categoryImportCreated")}
      />
      <Chip
        tone="updated"
        icon={<Pencil className="h-3.5 w-3.5" />}
        value={updated}
        label={t("categoryImportUpdated")}
      />
      <Chip
        tone="removed"
        icon={<Minus className="h-3.5 w-3.5" />}
        value={removed}
        label={t("categoryImportDeleted")}
      />
    </div>
  );
}

const TONE = {
  added: "text-success bg-success/10 border-success/30",
  updated: "text-warning bg-warning/10 border-warning/30",
  removed: "text-error bg-error/10 border-error/30",
} as const;

function Chip({
  tone,
  icon,
  value,
  label,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        value === 0
          ? "border-border-default bg-bg-elevated text-text-muted"
          : TONE[tone]
      )}
    >
      {icon}
      <span className="tabular-nums font-semibold">{value}</span>
      {label}
    </span>
  );
}

function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-1.5">{children}</ul>;
}

/** An added or updated node — its path, an editable code, and the composed result. */
function CodeRow({
  tone,
  path,
  segment,
  composed,
  previous,
  onSegment,
  t,
}: {
  tone: "added" | "updated";
  path: string[];
  segment: string;
  composed: { codePrefix: string | null; error: string | null };
  previous?: string | null;
  onSegment: (v: string) => void;
  t: T;
}) {
  const noCode = t("categoryImportNoCode");
  const changed = previous !== undefined && previous !== composed.codePrefix;

  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border-l-2 bg-bg-elevated px-3 py-2",
        tone === "added" ? "border-l-success" : "border-l-warning"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-sm text-text-primary">
          {joinCategoryPath(path)}
        </span>
        {composed.error ? (
          <span className="text-xs text-error">{composed.error}</span>
        ) : changed ? (
          // Before → after, so a code change reads at a glance.
          <span className="flex items-center gap-1.5 font-mono text-sm">
            <span className="text-text-muted line-through decoration-text-muted/40">
              {previous ?? noCode}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <span className="font-semibold text-warning">
              {composed.codePrefix ?? noCode}
            </span>
          </span>
        ) : (
          <span className="font-mono text-sm text-text-secondary">
            {composed.codePrefix ?? noCode}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          {t("categoryImportCodeLabel")}
        </span>
        <Input
          value={segment}
          onChange={(e) => onSegment(e.target.value)}
          placeholder={t("categoryImportCodePlaceholder")}
          className="h-8 w-28 py-1 text-xs uppercase"
          aria-label={t("categoryImportCodeLabel")}
        />
      </div>
    </li>
  );
}

/** A removal — kept or gone, with what's holding a blocked one in place. */
function RemovalRow({
  delete: d,
  blocked,
  kept,
  onKeep,
  t,
}: {
  delete: CategoryImportDelete;
  blocked: boolean;
  kept: boolean;
  onKeep: (keep: boolean) => void;
  t: T;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border-l-2 bg-bg-elevated px-3 py-2",
        kept ? "border-l-border-default" : "border-l-error"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            kept
              ? "text-text-secondary"
              : "text-text-primary line-through decoration-error/50"
          )}
        >
          {joinCategoryPath(d.path)}
        </span>
        <div className="shrink-0">
          {blocked ? (
            <span className="text-xs font-medium text-text-muted">
              {t("categoryImportKeptLocked")}
            </span>
          ) : (
            <Checkbox
              checked={kept}
              onCheckedChange={onKeep}
              label={t("categoryImportKeep")}
            />
          )}
        </div>
      </div>
      {blocked ? (
        <p className="text-xs text-error">{describeReferences(d, t)}</p>
      ) : (
        <p className="text-xs text-text-muted">
          {kept ? t("categoryImportWillKeep") : t("categoryImportWillRemove")}
        </p>
      )}
    </li>
  );
}

function ResultView({
  result,
  onClose,
  closeLabel,
  t,
}: {
  result: { created: number; updated: number; deleted: number };
  onClose: () => void;
  closeLabel: string;
  t: T;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-4">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="text-sm text-text-secondary">{t("categoryImportDone")}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("categoryImportCreated")} value={result.created} />
        <Stat label={t("categoryImportUpdated")} value={result.updated} />
        <Stat label={t("categoryImportDeleted")} value={result.deleted} />
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      {icon}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text-primary">{title}</p>
        <p className="max-w-sm text-sm text-text-secondary">{body}</p>
      </div>
      {action}
    </div>
  );
}

function Footer({
  onBack,
  children,
  t,
}: {
  onBack: () => void;
  children: React.ReactNode;
  t: T;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onBack}>
        {t("categoryImportChooseAnother")}
      </Button>
      {children}
    </div>
  );
}

/** Spell out what is holding a category in place, rather than just a count. */
function describeReferences(d: CategoryImportDelete, t: T): string {
  const { references } = d;
  const parts: string[] = [];
  const add = (count: number, key: string) => {
    if (count > 0) parts.push(t(key, { count }));
  };
  add(references.elements, "categoryImportRefElements");
  add(references.vendorTrades, "categoryImportRefVendorTrades");
  add(references.boqItems, "categoryImportRefBoqItems");
  add(references.rfqItems, "categoryImportRefRfqItems");
  add(references.rateContracts, "categoryImportRefRateContracts");
  add(references.rateContractItems, "categoryImportRefRateContractItems");
  return t("categoryImportBlockedBy", { refs: parts.join(", ") });
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "error" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-error/40 bg-error/10 text-error"
      : "border-warning/40 bg-warning/10 text-warning";
  return (
    <div className={cn("rounded-lg border p-3 text-xs", styles)}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-elevated p-3 text-center">
      <p className="text-2xl font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
