"use client";

import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
// Org management moved from the standalone /organisation route into settings.
// The hook + presentational pieces still live under the organisation route
// folder (now redirect-only) and are reused as-is.
import { useOrganisation } from "../../organisation/_hooks/useOrganisation";
import { CreateOrgForm } from "../../organisation/_components/CreateOrgForm";
import { OrgDetailsCard } from "../../organisation/_components/OrgDetailsCard";
import { MembersList } from "../../organisation/_components/MembersList";
import { PendingInvitations } from "../../organisation/_components/PendingInvitations";
import { InviteDialog } from "../../organisation/_components/InviteDialog";

/**
 * Organisation management as a settings section: org details, members,
 * invitations. Rendered only for PMs (owner/admin) by the settings page.
 * Self-contained — owns the `useOrganisation` data + mutation state.
 */
export function OrganizationSection() {
  const t = useTranslations("organisation");
  const org = useOrganisation();

  if (org.loading) {
    return (
      <div className="flex flex-col gap-6">
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

  // No org yet — show the create form.
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

  const canInvite =
    org.currentUserRole === "owner" || org.currentUserRole === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t("title")}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{org.activeOrg.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={org.refresh} />
          {canInvite && (
            <Button onClick={() => org.setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              {t("inviteMember")}
            </Button>
          )}
        </div>
      </div>

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
    </div>
  );
}
