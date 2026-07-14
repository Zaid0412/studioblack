"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { ApiError } from "@/lib/api/client";
import { elementCategories as categoriesApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
import type {
  CategoryImportPlan,
  CategoryParseResponse,
} from "@/lib/api/element-categories";
import type { CategoryImportDelete } from "@/lib/queries/categoryImport";
import { joinCategoryPath } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { CATEGORY_IMPORT_MAX_BYTES } from "@/lib/validations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "importing" | "result";

/**
 * Import the category taxonomy from a spreadsheet.
 *
 * The import is a diff, not a replacement — see `planCategoryImport`. What the
 * user sees before committing is therefore three numbers and, if anything is in
 * the way, exactly what: a category cannot be removed while elements, BOQ items,
 * vendor trades or rate contracts still point at it, and the whole import is
 * refused rather than half-applied.
 */
export function CategoryImportDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [parse, setParse] = useState<CategoryParseResponse | null>(null);
  /**
   * Only set by a 409: the server re-plans under its own transaction, so it can
   * block something the preview thought was free. Until then the preview's own
   * list is the truth.
   */
  const [serverBlocked, setServerBlocked] = useState<
    CategoryImportDelete[] | null
  >(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    deleted: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setParse(null);
    setServerBlocked(null);
    setResult(null);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > CATEGORY_IMPORT_MAX_BYTES) {
      toast({ title: t("categoryImportTooLarge"), variant: "error" });
      return;
    }

    setStep("importing");
    try {
      const parsed = await categoriesApi.validateImport(file);
      setParse(parsed);
      setServerBlocked(null);
      setStep("preview");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t("categoryImportFailed"),
        variant: "error",
      });
      setStep("upload");
    }
  };

  const confirm = async () => {
    const paths = parse?.rows
      .map((r) => r.parsed?.path)
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!paths?.length) return;

    setStep("importing");
    try {
      const res = await categoriesApi.confirmImport(paths);
      setResult(res);
      setStep("result");
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryImportDone") });
    } catch (err) {
      // 409: something still points at a category the sheet drops. The server
      // re-checks under its own transaction, so this can fire even when the
      // preview was clean — someone filed an element under it in between.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.details as { blocked?: CategoryImportDelete[] } | null;
        setServerBlocked(body?.blocked ?? []);
        setStep("preview");
        return;
      }
      toast({
        title: err instanceof Error ? err.message : t("categoryImportFailed"),
        variant: "error",
      });
      setStep("preview");
    }
  };

  const rowErrors = parse?.rows.filter((r) => r.status === "error") ?? [];
  const plan: CategoryImportPlan | null = parse?.plan ?? null;
  const blocked = serverBlocked ?? plan?.blocked ?? [];
  const noChanges =
    plan !== null &&
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0;
  const canImport =
    plan !== null &&
    blocked.length === 0 &&
    rowErrors.length === 0 &&
    !noChanges;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("categoryImportTitle")}</DialogTitle>
          <DialogDescription>{t("categoryImportSubtitle")}</DialogDescription>
        </DialogHeader>

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
            <p className="text-sm text-text-secondary">{tCommon("loading")}</p>
          </div>
        )}

        {step === "upload" && (
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
                handleFile(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                dragOver
                  ? "border-accent bg-accent/10"
                  : "border-border-default hover:border-border-light"
              }`}
            >
              <FileSpreadsheet className="h-8 w-8 text-text-secondary" />
              <p className="text-sm text-text-secondary">
                {t("categoryImportDropzone")}
              </p>
              <p className="text-xs text-text-muted">
                {t("categoryImportMaxSize")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  handleFile(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-text-muted">
              {t("categoryImportTemplateHint")}{" "}
              <a
                href={categoriesApi.downloadImportTemplate()}
                className="text-accent hover:underline"
              >
                {t("categoryImportDownloadCurrent")}
              </a>
            </p>
          </div>
        )}

        {step === "preview" && parse && (
          <div className="flex flex-col gap-4">
            {rowErrors.length > 0 && (
              <Banner tone="error" title={t("categoryImportRowErrors")}>
                <ul className="flex flex-col gap-1">
                  {rowErrors.slice(0, 8).map((row) => (
                    <li key={row.rowNumber}>
                      {t("categoryImportRowLabel", {
                        row: row.excelRowNumber,
                      })}{" "}
                      — {row.errors.join("; ")}
                    </li>
                  ))}
                </ul>
              </Banner>
            )}

            {blocked.length > 0 && (
              <Banner tone="error" title={t("categoryImportBlockedTitle")}>
                <p className="mb-2">{t("categoryImportBlockedHint")}</p>
                <ul className="flex flex-col gap-1">
                  {blocked.map((b) => (
                    <li key={b.id}>
                      <span className="font-medium">
                        {joinCategoryPath(b.path)}
                      </span>{" "}
                      — {describeReferences(b, t)}
                    </li>
                  ))}
                </ul>
              </Banner>
            )}

            {plan && rowErrors.length === 0 && (
              <>
                {noChanges ? (
                  <p className="text-sm text-text-secondary">
                    {t("categoryImportNoChanges")}
                  </p>
                ) : (
                  <Banner tone="warning" title={t("categoryImportWarning")}>
                    <p>
                      {t("categoryImportCounts", {
                        created: plan.creates.length,
                        updated: plan.updates.length,
                        deleted: plan.deletes.length,
                      })}
                    </p>
                    <p className="mt-1">{t("categoryImportCodeNote")}</p>
                  </Banner>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => reset()}>
                {t("categoryImportChooseAnother")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirm}
                disabled={!canImport}
              >
                {t("categoryImportConfirm")}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("categoryImportCreated")} value={result.created} />
              <Stat label={t("categoryImportUpdated")} value={result.updated} />
              <Stat label={t("categoryImportDeleted")} value={result.deleted} />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => close(false)}>
                {tCommon("close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Spell out what is holding a category in place, rather than just a count. */
function describeReferences(
  blocked: CategoryImportDelete,
  t: ReturnType<typeof useTranslations>
): string {
  const { references } = blocked;
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
  return parts.join(", ");
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
    <div className={`rounded-lg border p-3 text-xs ${styles}`}>
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
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
