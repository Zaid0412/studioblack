"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Building2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";

interface PendingInvitation {
  id: string;
  organizationName: string;
  role: string;
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

  const { data: invitations = [], mutate } = useSWR<PendingInvitation[]>(
    "invitation-banner",
    async () => {
      const { data } = await authClient.organization.listUserInvitations();
      if (!data) return [];
      return data
        .filter((inv: { status: string }) => inv.status === "pending")
        .map(
          (inv: {
            id: string;
            organizationName?: string;
            organizationId: string;
            role?: string;
          }) => ({
            id: inv.id,
            organizationName: inv.organizationName ?? inv.organizationId,
            role: inv.role ?? "member",
          })
        );
    },
    { refreshInterval: 30_000 }
  );

  const roleLabel = useCallback(
    (role: string) => {
      if (role === "owner") return t("roleOwner");
      if (role === "admin") return t("rolePM");
      if (role === "member") return t("roleArchitect");
      return role;
    },
    [t]
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
      mutate((prev) => prev?.filter((i) => i.id !== inv.id), {
        revalidate: false,
      });
      window.dispatchEvent(new Event("notifications-changed"));
      router.push("/organisation");
    },
    [t, mutate, router]
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
      mutate((prev) => prev?.filter((i) => i.id !== inv.id), {
        revalidate: false,
      });
      window.dispatchEvent(new Event("notifications-changed"));
    },
    [t, mutate]
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
              {t("bannerRole", { role: roleLabel(inv.role) })}
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
