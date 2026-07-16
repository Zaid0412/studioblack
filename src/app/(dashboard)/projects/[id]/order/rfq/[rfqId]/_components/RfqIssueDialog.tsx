"use client";

import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useRfqSuggestedVendors } from "@/hooks/useRfqs";

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
  /**
   * Vendor ids to pre-check when the dialog opens — used when issuing a
   * revision, which carries its parent RFQ's vendors as a default (RFQ-3b).
   */
  preselectedVendorIds?: string[];
  /**
   * Vendor ids already invited to this RFQ — shown checked + disabled with an
   * "Invited" tag so the invite-more flow only adds genuinely new vendors.
   */
  lockedVendorIds?: string[];
}

/**
 * Vendor picker + confirmation, shared by the Issue and Invite-more flows.
 * Defaults to every active vendor in the org; the toggle narrows the list to
 * the trade-matched suggestions when the full list is too broad.
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
  preselectedVendorIds,
  lockedVendorIds,
}: Props) {
  const tIssue = useTranslations("rfq.issue");
  const tInvite = useTranslations("rfq.invite");
  const t = mode === "invite" ? tInvite : tIssue;

  const [showAll, setShowAll] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const locked = new Set(lockedVendorIds ?? []);

  // Seed once per open: a revision starts from its copied vendors; a normal
  // issue starts empty. Picks shouldn't survive a cancel, and a background
  // refetch of the RFQ must NOT overwrite the PM's in-dialog edits — so we read
  // the latest preselection via a ref and key the effect on `open` alone.
  const preselectRef = useRef(preselectedVendorIds);
  preselectRef.current = preselectedVendorIds;
  useEffect(() => {
    if (open) {
      setSelected(new Set(preselectRef.current ?? []));
      setShowAll(true);
      setQuery("");
    }
  }, [open]);

  const { vendors, isLoading } = useRfqSuggestedVendors(
    projectId,
    rfqId,
    open,
    showAll
  );

  // Client-side filter over the already-fetched list — matches name, code, or
  // primary contact email.
  const q = query.trim().toLowerCase();
  const filteredVendors = q
    ? vendors.filter(
        (v) =>
          v.company_name.toLowerCase().includes(q) ||
          (v.vendor_code ?? "").toLowerCase().includes(q) ||
          (v.primary_contact_email ?? "").toLowerCase().includes(q)
      )
    : vendors;

  const toggle = (id: string) => {
    if (locked.has(id)) return; // already invited — not togglable
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

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoFocus
        />

        <div className="flex items-center justify-between gap-2 pb-1">
          <span className="text-xs text-text-muted">
            {showAll ? t("allLabel") : t("suggestedLabel")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? t("showSuggested") : t("showAll")}
          </Button>
        </div>

        <div className="rounded-lg border border-border-default bg-bg-input max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-sm text-text-muted text-center">
              {t("loading")}
            </p>
          ) : filteredVendors.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={t("noVendors")}
              description={q ? t("noSearchMatch") : t("noVendorsHint")}
            />
          ) : (
            <ul className="divide-y divide-border-default">
              {filteredVendors.map((v) => {
                const isLocked = locked.has(v.id);
                return (
                  <li
                    key={v.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      isLocked
                        ? "opacity-60 cursor-default"
                        : "hover:bg-bg-elevated/40 cursor-pointer"
                    }`}
                    onClick={() => toggle(v.id)}
                  >
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex"
                    >
                      <Checkbox
                        checked={isLocked || selected.has(v.id)}
                        disabled={isLocked}
                        onCheckedChange={() => toggle(v.id)}
                        aria-label={v.company_name}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {v.company_name}
                        </span>
                        {v.preferred_vendor && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent cursor-default">
                                {t("preferred")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("preferredTooltip")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isLocked && (
                          <span className="shrink-0 rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                            {t("alreadyInvited")}
                          </span>
                        )}
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
                );
              })}
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
