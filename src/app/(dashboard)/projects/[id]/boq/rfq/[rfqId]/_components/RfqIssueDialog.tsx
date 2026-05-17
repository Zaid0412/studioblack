"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, UsersRound } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRfqSuggestedVendors } from "@/hooks/useRfqs";
import type { VendorLite } from "@/types";

interface Props {
  projectId: string;
  rfqId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (vendorIds: string[]) => Promise<void>;
  /**
   * `issue` = first-time fan-out (flips status draft → issued).
   * `invite` = additive on an already-issued RFQ. Only changes copy on
   * the dialog; the actual mutation is the parent's call.
   */
  mode?: "issue" | "invite";
}

/**
 * Vendor picker + confirmation, shared by the Issue and Invite-more flows.
 * Suggested list comes from the trade-match query; "Show all vendors"
 * remains a stub until F10 ships a broader endpoint.
 *
 * Submit calls `onConfirm`. The parent owns the actual API call so the
 * mutated RFQ state can be merged into its SWR cache.
 */
export function RfqIssueDialog({
  projectId,
  rfqId,
  open,
  onOpenChange,
  onConfirm,
  mode = "issue",
}: Props) {
  const tIssue = useTranslations("rfq.issue");
  const tInvite = useTranslations("rfq.invite");
  const t = mode === "invite" ? tInvite : tIssue;

  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Reset every time the dialog reopens — picks shouldn't survive a cancel.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setShowAll(false);
    }
  }, [open]);

  const { vendors: suggested, isLoading } = useRfqSuggestedVendors(
    projectId,
    rfqId,
    open
  );

  // "Show all" hasn't been wired to a separate endpoint yet — for now we
  // surface the same trade-matched list and rely on the broader vendor
  // search in the All Vendors page for the escape hatch. The toggle is
  // kept in the UI so the empty-state message can point users at it.
  const vendors: VendorLite[] = useMemo(() => suggested, [suggested]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit = selected.size > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { count: selected.size })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-1">
          <span className="text-xs text-text-muted">
            {showAll ? t("allLabel") : t("suggestedLabel")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            disabled
            title={t("showAllComingSoon")}
          >
            {showAll ? t("showSuggested") : t("showAll")}
          </Button>
        </div>

        <div className="rounded-lg border border-border-default bg-bg-input max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-sm text-text-muted text-center">
              {t("loading")}
            </p>
          ) : vendors.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={t("noVendors")}
              description={t("noVendorsHint")}
            />
          ) : (
            <ul className="divide-y divide-border-default">
              {vendors.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/40 cursor-pointer"
                  onClick={() => toggle(v.id)}
                >
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                  >
                    <Checkbox
                      checked={selected.has(v.id)}
                      onCheckedChange={() => toggle(v.id)}
                      aria-label={v.company_name}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {v.company_name}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {v.vendor_code ?? "—"}
                      {v.primary_contact_email
                        ? ` · ${v.primary_contact_email}`
                        : ""}
                    </div>
                  </div>
                  {v.rating > 0 && (
                    <span className="text-xs text-text-secondary tabular-nums">
                      {v.rating.toFixed(1)} ★
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("emailWarning")}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={submitting}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("confirm", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
