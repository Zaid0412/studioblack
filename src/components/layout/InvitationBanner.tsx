"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { Building2, Check, X } from "lucide-react";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";

interface PendingInvitation {
  id: string;
  organizationName: string;
  role: string;
}

/**
 * Derives pending received invitations from the shared "invitations" SWR cache
 * managed by useNotifications. No separate API call — zero duplication.
 */
function extractPendingInvitations(
  invData:
    | { pendingIds?: Map<string, string>; notifications?: unknown[] }
    | undefined
): PendingInvitation[] {
  if (!invData?.pendingIds) return [];
  const pending: PendingInvitation[] = [];
  for (const [notifId, realId] of invData.pendingIds) {
    // Find matching notification to get org name and role
    const notif = (
      invData.notifications as
        | { id: string; description?: string }[]
        | undefined
    )?.find((n) => n.id === notifId);
    if (!notif?.description) continue;
    // Description format: "OrgName — RoleLabel"
    const [orgName, roleLabel] = notif.description.split(" — ");
    pending.push({
      id: realId,
      organizationName: orgName ?? "Organisation",
      role: roleLabel ?? "member",
    });
  }
  return pending;
}

/** Prominent banner shown at the top of the dashboard when the user has pending org invitations. */
export function InvitationBanner() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = sessionStorage.getItem("dismissed-invitations");
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Read from the same SWR key as useNotifications — no extra API call
  const { data: invData } = useSWR("invitations");
  const invitations = useMemo(
    () =>
      extractPendingInvitations(
        invData as Parameters<typeof extractPendingInvitations>[0]
      ),
    [invData]
  );

  const visible = useMemo(
    () => invitations.filter((inv) => !dismissed.has(inv.id)),
    [invitations, dismissed]
  );

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem(
          "dismissed-invitations",
          JSON.stringify([...next])
        );
      } catch {
        // sessionStorage may be unavailable
      }
      return next;
    });
  }, []);

  const handleAccept = useCallback(
    async (inv: PendingInvitation) => {
      setLoadingId(inv.id);
      const { error } = await authClient.organization.acceptInvitation({
        invitationId: inv.id,
      });
      setLoadingId(null);
      if (error) {
        toast({ title: t("acceptError"), variant: "error" });
        return;
      }
      toast({
        title: t("invitationAccepted"),
        description: t("invitationAcceptedDesc"),
        variant: "success",
      });
      // Invalidate shared cache so both banner and notification panel update
      globalMutate("invitations");
      window.dispatchEvent(new Event("notifications-changed"));
      router.push("/settings?section=organization");
    },
    [t, router]
  );

  const handleReject = useCallback(
    async (inv: PendingInvitation) => {
      setLoadingId(inv.id);
      const { error } = await authClient.organization.rejectInvitation({
        invitationId: inv.id,
      });
      setLoadingId(null);
      if (error) {
        toast({ title: t("rejectError"), variant: "error" });
        return;
      }
      toast({
        title: t("invitationRejected"),
        description: t("invitationRejectedDesc"),
      });
      globalMutate("invitations");
      window.dispatchEvent(new Event("notifications-changed"));
    },
    [t]
  );

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-6">
      {visible.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-4 px-4 py-3.5 lg:px-6 rounded-lg bg-accent border border-accent dark:bg-bg-secondary dark:border-border-default"
        >
          <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-accent/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-black/70 dark:text-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-black dark:text-text-primary truncate">
              {t("bannerTitle", { orgName: inv.organizationName })}
            </p>
            <p className="text-xs text-black/60 dark:text-text-secondary">
              {t("bannerRole", { role: inv.role })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={loadingId === inv.id}
              onClick={() => handleAccept(inv)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-md bg-black text-white hover:bg-black/80 disabled:opacity-50 transition-colors cursor-pointer dark:bg-accent dark:text-black dark:hover:bg-accent-hover"
            >
              <Check className="w-3.5 h-3.5" />
              {loadingId === inv.id ? "..." : t("accept")}
            </button>
            <button
              disabled={loadingId === inv.id}
              onClick={() => handleReject(inv)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md border border-black/30 text-black/70 hover:bg-black/10 disabled:opacity-50 transition-colors cursor-pointer dark:border-border-default dark:text-text-secondary dark:hover:bg-bg-tertiary"
            >
              {t("reject")}
            </button>
          </div>

          <button
            onClick={() => dismiss(inv.id)}
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-bg-tertiary transition-colors text-black/40 dark:text-text-muted cursor-pointer"
            aria-label={t("dismiss")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
