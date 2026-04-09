"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import type { OrgMember, OrgInvitation } from "@/types";

interface OrgData {
  org: { id: string; name: string; slug: string; logo?: string | null };
  members: OrgMember[];
  invitations: OrgInvitation[];
  currentUserRole: string | null;
}

/** Fetches org data via authClient. Used as custom SWR fetcher. */
async function orgFetcher(): Promise<OrgData | null> {
  // First try to get the active org
  let { data } = await authClient.organization.getFullOrganization();

  // If no active org, list all orgs and activate the first one
  if (!data) {
    const listRes = await authClient.organization.list();
    if (listRes.data && listRes.data.length > 0) {
      const firstOrg = listRes.data[0];
      await authClient.organization.setActive({
        organizationId: firstOrg.id,
      });
      const retry = await authClient.organization.getFullOrganization();
      data = retry.data;
    }
  }

  if (!data) return null;

  const members = (data.members as OrgMember[]) ?? [];

  // Determine current user's role
  const session = await authClient.getSession();
  let currentUserRole: string | null = null;
  if (session.data?.user) {
    const me = members.find((m) => m.userId === session.data!.user.id);
    currentUserRole = me?.role ?? null;
  }

  return {
    org: { id: data.id, name: data.name, slug: data.slug, logo: data.logo },
    members,
    invitations: (data.invitations as OrgInvitation[]) ?? [],
    currentUserRole,
  };
}

/** Hook managing organisation state, members, invitations, and CRUD operations. */
export function useOrganisation() {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const router = useRouter();

  // -- Org data (SWR with auto-polling, pauses when tab hidden) --
  const {
    data: orgData,
    isLoading: loading,
    mutate,
  } = useSWR<OrgData | null>("org-full", orgFetcher, {
    refreshInterval: 30000,
  });

  const activeOrg = orgData?.org ?? null;
  const members = orgData?.members ?? [];
  const invitations = orgData?.invitations ?? [];
  const currentUserRole = orgData?.currentUserRole ?? null;

  // -- UI state --
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCreateOrg = async () => {
    setIsCreating(true);
    const { error } = await authClient.organization.create({
      name: orgName.trim(),
      slug: orgSlug.trim(),
    });
    if (error) {
      const msg =
        error.code === "ORGANIZATION_ALREADY_EXISTS"
          ? t("alreadyExists")
          : (error.message ?? t("createError"));
      toast({
        title: tc("error") ?? "Error",
        description: msg,
        variant: "error",
      });
      setIsCreating(false);
      if (error.code === "ORGANIZATION_ALREADY_EXISTS") {
        await mutate();
      }
      return;
    }
    toast({
      title: t("createdToast"),
      description: t("createdDescription"),
      variant: "success",
    });
    setOrgName("");
    setOrgSlug("");
    await mutate();
    setIsCreating(false);
  };

  const handleInvite = async () => {
    if (!activeOrg) return;
    setIsInviting(true);

    await authClient.organization.setActive({
      organizationId: activeOrg.id,
    });

    const { error } = await authClient.organization.inviteMember({
      email: inviteEmail.trim(),
      role: inviteRole as "admin" | "member",
      organizationId: activeOrg.id,
    });
    if (error) {
      toast({
        title: tc("error") ?? "Error",
        description: error.message ?? t("inviteError"),
        variant: "error",
      });
      setIsInviting(false);
      return;
    }
    toast({
      title: t("inviteSent"),
      description: t("inviteSentDescription"),
      variant: "success",
    });
    setInviteEmail("");
    setInviteRole("member");
    setInviteOpen(false);
    setIsInviting(false);
    await mutate();
  };

  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    if (!activeOrg) return;
    const { error } = await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId: activeOrg.id,
    });
    if (error) {
      toast({
        title: tc("error") ?? "Error",
        description: error.message ?? t("changeRoleError"),
        variant: "error",
      });
      return;
    }
    toast({
      title: t("roleUpdated"),
      description: t("roleUpdatedDescription"),
      variant: "success",
    });
    await mutate();
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
    });
    if (error) {
      toast({
        title: tc("error") ?? "Error",
        description: error.message ?? t("removeError"),
        variant: "error",
      });
      return;
    }
    toast({
      title: t("memberRemoved"),
      description: t("memberRemovedDescription"),
      variant: "success",
    });
    await mutate();
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (error) {
      toast({
        title: tc("error") ?? "Error",
        description: error.message ?? t("cancelInviteError"),
        variant: "error",
      });
      return;
    }
    toast({
      title: t("inviteCancelled"),
      description: t("inviteCancelledDescription"),
      variant: "success",
    });
    await mutate();
  };

  const handleLeaveOrg = async () => {
    if (!activeOrg) return;
    setIsLeaving(true);

    const session = await authClient.getSession();
    if (!session.data?.user) {
      setIsLeaving(false);
      return;
    }
    const me = members.find((m) => m.userId === session.data!.user.id);
    if (!me) {
      setIsLeaving(false);
      return;
    }

    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: me.id,
    });
    setIsLeaving(false);
    setLeaveDialogOpen(false);

    if (error) {
      toast({
        title: tc("error") ?? "Error",
        description: error.message ?? "Failed to leave organisation",
        variant: "error",
      });
      return;
    }

    toast({
      title: "Left organisation",
      description: `You have left ${activeOrg.name}`,
      variant: "success",
    });
    router.push("/dashboard");
  };

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    // Org state
    activeOrg,
    members,
    invitations,
    loading,
    currentUserRole,

    // Create org form
    orgName,
    setOrgName,
    orgSlug,
    setOrgSlug,
    isCreating,
    generateSlug,
    handleCreateOrg,

    // Invite dialog
    inviteOpen,
    setInviteOpen,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    isInviting,
    handleInvite,

    // Members
    handleUpdateMemberRole,
    handleRemoveMember,
    handleCancelInvitation,

    // Leave org
    leaveDialogOpen,
    setLeaveDialogOpen,
    isLeaving,
    handleLeaveOrg,

    // Refresh
    refresh,
  };
}
