"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import type { OrgMember, OrgInvitation } from "@/types";

/**
 *
 */
export function useOrganisation() {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const router = useRouter();

  // Org state
  const [activeOrg, setActiveOrg] = useState<{
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  } | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Create org form
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Current user's role in the org
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Leave org dialog
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  const loadOrg = async (showLoading = false) => {
    if (showLoading) setLoading(true);

    // First try to get the active org
    let { data } = await authClient.organization.getFullOrganization();

    // If no active org, list all orgs the user belongs to and activate the first one
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

    if (data) {
      setActiveOrg({
        id: data.id,
        name: data.name,
        slug: data.slug,
        logo: data.logo,
      });
      setMembers((data.members as OrgMember[]) ?? []);
      setInvitations((data.invitations as OrgInvitation[]) ?? []);

      // Determine current user's role in the org
      const session = await authClient.getSession();
      if (session.data?.user) {
        const me = (data.members as OrgMember[])?.find(
          (m) => m.userId === session.data!.user.id
        );
        setCurrentUserRole(me?.role ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrg(true);
    const interval = setInterval(() => loadOrg(), 30000);
    return () => clearInterval(interval);
  }, []);

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
      // If it already exists, try loading it
      if (error.code === "ORGANIZATION_ALREADY_EXISTS") {
        await loadOrg();
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
    await loadOrg();
    setIsCreating(false);
  };

  const handleInvite = async () => {
    if (!activeOrg) return;
    setIsInviting(true);

    // Ensure active org is set on the session before inviting
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
    await loadOrg();
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
    await loadOrg();
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
    await loadOrg();
  };

  const handleLeaveOrg = async () => {
    if (!activeOrg) return;
    setIsLeaving(true);

    // Get current session to find own member ID
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
    handleRemoveMember,
    handleCancelInvitation,

    // Leave org
    leaveDialogOpen,
    setLeaveDialogOpen,
    isLeaving,
    handleLeaveOrg,
  };
}
