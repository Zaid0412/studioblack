"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserPlus, LogOut } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganisation } from "./_hooks/useOrganisation";
import { CreateOrgForm } from "./_components/CreateOrgForm";
import { OrgDetailsCard } from "./_components/OrgDetailsCard";
import { MembersList } from "./_components/MembersList";
import { PendingInvitations } from "./_components/PendingInvitations";
import { InviteDialog } from "./_components/InviteDialog";
import { LeaveDialog } from "./_components/LeaveDialog";

/** Organisation management page — create org, invite & manage members. */
export default function OrganisationPage() {
  const t = useTranslations("organisation");
  const { role } = useUserRole();
  const router = useRouter();
  const org = useOrganisation();

  // Block clients from accessing this page
  useEffect(() => {
    if (role === "client") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  if (org.loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[800px]">
        <PageHeader title={t("title")} />
        {/* Org details card skeleton */}
        <Card>
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full ml-auto" />
          </div>
        </Card>
        {/* Members list skeleton */}
        <Card>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-3 border-b border-border-default last:border-0"
              >
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // No org yet — show create form
  if (!org.activeOrg) {
    return (
      <CreateOrgForm
        orgName={org.orgName}
        setOrgName={org.setOrgName}
        orgSlug={org.orgSlug}
        setOrgSlug={org.setOrgSlug}
        isCreating={org.isCreating}
        generateSlug={org.generateSlug}
        handleCreateOrg={org.handleCreateOrg}
      />
    );
  }

  // Has org — show details + members
  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <PageHeader
        title={t("title")}
        subtitle={org.activeOrg.name}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={org.refresh} />
            {(org.currentUserRole === "owner" ||
              org.currentUserRole === "admin") && (
              <Button onClick={() => org.setInviteOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                {t("inviteMember")}
              </Button>
            )}
            {org.currentUserRole === "member" && (
              <Button
                variant="secondary"
                onClick={() => org.setLeaveDialogOpen(true)}
                className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("leaveOrganisation")}
              </Button>
            )}
          </div>
        }
      />

      <OrgDetailsCard
        name={org.activeOrg.name}
        slug={org.activeOrg.slug}
        memberCount={org.members.length}
      />

      <MembersList
        members={org.members}
        currentUserRole={org.currentUserRole}
        onUpdateRole={org.handleUpdateMemberRole}
        onRemoveMember={org.handleRemoveMember}
      />

      <PendingInvitations
        invitations={org.invitations}
        onCancelInvitation={org.handleCancelInvitation}
      />

      <InviteDialog
        open={org.inviteOpen}
        onOpenChange={org.setInviteOpen}
        inviteEmail={org.inviteEmail}
        setInviteEmail={org.setInviteEmail}
        inviteRole={org.inviteRole}
        setInviteRole={org.setInviteRole}
        isInviting={org.isInviting}
        onInvite={org.handleInvite}
      />

      <LeaveDialog
        open={org.leaveDialogOpen}
        onOpenChange={org.setLeaveDialogOpen}
        orgName={org.activeOrg.name}
        isLeaving={org.isLeaving}
        onLeave={org.handleLeaveOrg}
      />
    </div>
  );
}
