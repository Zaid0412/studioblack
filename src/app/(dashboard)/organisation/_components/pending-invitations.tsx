"use client";

import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "../_lib/role-helpers";
import type { OrgInvitation } from "@/types";

interface PendingInvitationsProps {
  invitations: OrgInvitation[];
  onCancelInvitation: (invitationId: string) => void;
}

/**
 *
 */
export function PendingInvitations({
  invitations,
  onCancelInvitation,
}: PendingInvitationsProps) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");

  const pending = invitations.filter((inv) => inv.status === "pending");
  if (pending.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-text-primary">
          {t("pendingInvitations")}
        </h3>
        <div className="flex flex-col">
          {pending.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 py-3 border-b border-border-default last:border-0"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-bg-elevated">
                <UserPlus className="w-4 h-4 text-text-muted" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-text-primary truncate">
                  {inv.email}
                </span>
                <span className="text-xs text-text-muted">
                  {roleLabel(inv.role ?? "member", t)}
                </span>
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {(() => {
                  const days = Math.ceil(
                    (new Date(inv.expiresAt).getTime() - Date.now()) / 86400000
                  );
                  if (days < 0) return t("expired");
                  if (days === 0) return t("expiresToday");
                  return t("expiresIn", { count: days });
                })()}
              </span>
              <Badge variant="warning">{t("pending")}</Badge>
              <button
                onClick={() => onCancelInvitation(inv.id)}
                className="text-xs text-text-muted hover:text-red-500 transition-colors cursor-pointer"
              >
                {tc("cancel")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
