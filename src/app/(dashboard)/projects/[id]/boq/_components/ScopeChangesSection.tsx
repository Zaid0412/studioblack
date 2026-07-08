"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/useToast";
import { scopeChanges as scopeChangesApi } from "@/lib/api";
import type { ListScopeChangesResponse } from "@/lib/api/scopeChanges";
import type {
  ScopeChangeAction,
  ScopeChangeStatus,
} from "@/lib/validations";
import { ScopeChangeDialog } from "./ScopeChangeDialog";

interface Props {
  boqItemId: string;
}

const STATUS_VARIANT: Record<ScopeChangeStatus, BadgeVariant> = {
  requested: "draft",
  under_review: "in-review",
  client_approval: "submitted",
  approved: "approved-client",
  implemented: "active",
  rejected: "error",
};

/** Studio actions offered for each status (client actions live in the portal). */
const STUDIO_ACTIONS: Partial<Record<ScopeChangeStatus, ScopeChangeAction[]>> = {
  requested: ["submit"],
  under_review: ["send_to_client", "reject_review"],
};

/**
 * Studio panel (in the BOQ item drawer) to raise + govern scope changes for a
 * single BOQ item. Client approve/reject happens in the client portal.
 */
export function ScopeChangesSection({ boqItemId }: Props) {
  const t = useTranslations("scopeChanges");
  const key = scopeChangesApi.listKey({ boqItemId, limit: 50 });
  const { data, mutate } = useSWR<ListScopeChangesResponse>(key);
  const rows = data?.rows ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Reject / implement confirmations carry the target id + a reject note.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [implementing, setImplementing] = useState<string | null>(null);

  const runTransition = async (
    id: string,
    action: ScopeChangeAction,
    note?: string
  ) => {
    setBusyId(id);
    try {
      await scopeChangesApi.transition(id, action, note);
      toast({ title: t("toastTransitioned") });
      await mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: msg, variant: "error" });
    } finally {
      setBusyId(null);
      setRejecting(null);
      setRejectNote("");
    }
  };

  const runImplement = async (id: string) => {
    setBusyId(id);
    try {
      await scopeChangesApi.implement(id);
      toast({ title: t("toastImplemented") });
      await mutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: msg, variant: "error" });
    } finally {
      setBusyId(null);
      setImplementing(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">{t("title")}</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("raise")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((sc) => {
            const actions = STUDIO_ACTIONS[sc.status] ?? [];
            const busy = busyId === sc.id;
            return (
              <li
                key={sc.id}
                className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-elevated p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {sc.sc_number}
                  </span>
                  <Badge variant={STATUS_VARIANT[sc.status]}>
                    {t(`status_${sc.status}`)}
                  </Badge>
                </div>
                <div className="text-xs text-text-secondary">
                  {t(`reason_${sc.change_reason}`)} · {t(`impact_${sc.impact}`)}
                </div>
                {sc.description && (
                  <p className="text-sm text-text-primary whitespace-pre-line">
                    {sc.description}
                  </p>
                )}
                {sc.status === "client_approval" && (
                  <p className="text-xs text-text-muted">{t("awaitingClient")}</p>
                )}

                {(actions.length > 0 || sc.status === "approved") && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {actions.includes("submit") && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => runTransition(sc.id, "submit")}
                      >
                        {t("action_submit")}
                      </Button>
                    )}
                    {actions.includes("send_to_client") && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => runTransition(sc.id, "send_to_client")}
                      >
                        {t("action_send_to_client")}
                      </Button>
                    )}
                    {actions.includes("reject_review") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setRejectNote("");
                          setRejecting(sc.id);
                        }}
                      >
                        {t("action_reject_review")}
                      </Button>
                    )}
                    {sc.status === "approved" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => setImplementing(sc.id)}
                      >
                        {t("action_implement")}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ScopeChangeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        boqItemId={boqItemId}
        onCreated={() => mutate()}
      />

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={t("action_reject_review")}
        destructive
        submitting={busyId !== null}
        confirmLabel={t("action_reject_review")}
        onConfirm={() => {
          if (rejecting) {
            void runTransition(
              rejecting,
              "reject_review",
              rejectNote.trim() || undefined
            );
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-text-secondary">
            {t("rejectNoteLabel")}
          </label>
          <textarea
            className="w-full rounded-lg border border-border-default bg-bg-input p-2 text-sm text-text-primary"
            rows={2}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            maxLength={2000}
            placeholder={t("rejectNotePlaceholder")}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={implementing !== null}
        onOpenChange={(o) => !o && setImplementing(null)}
        title={t("confirmImplementTitle")}
        description={t("confirmImplementBody")}
        submitting={busyId !== null}
        confirmLabel={t("action_implement")}
        onConfirm={() => {
          if (implementing) void runImplement(implementing);
        }}
      />
    </section>
  );
}
