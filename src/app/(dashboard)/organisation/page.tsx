"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  UserPlus,
  MoreHorizontal,
  Crown,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { authClient } from "@/lib/auth-client";
import { deriveInitials } from "@/lib/utils";

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
}

/** Organisation management page — create org, invite & manage members. */
export default function OrganisationPage() {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");

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

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadOrg(true);
    const interval = setInterval(() => loadOrg(), 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadOrg(showLoading = false) {
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
  }

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

  const roleIcon = (role: string) => {
    if (role === "owner" || role === "pm")
      return <Crown className="w-3.5 h-3.5" />;
    if (role === "admin" || role === "architect")
      return <Shield className="w-3.5 h-3.5" />;
    return <UserIcon className="w-3.5 h-3.5" />;
  };

  const roleLabel = (role: string) => {
    if (role === "owner") return t("roleOwner");
    if (role === "admin") return t("rolePM");
    if (role === "member") return t("roleArchitect");
    return role;
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[800px]">
        <PageHeader title={t("title")} />
        <p className="text-sm text-text-muted">{tc("loading")}</p>
      </div>
    );
  }

  // No org yet — show create form
  if (!activeOrg) {
    return (
      <div className="flex flex-col gap-6 max-w-[600px]">
        <PageHeader title={t("title")} subtitle={t("noOrgSubtitle")} />

        <Card>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  {t("createTitle")}
                </h3>
                <p className="text-sm text-text-muted">{t("createSubtitle")}</p>
              </div>
            </div>

            <Separator />

            <Input
              label={t("orgName")}
              placeholder={t("orgNamePlaceholder")}
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setOrgSlug(generateSlug(e.target.value));
              }}
            />
            <Input
              label={t("slug")}
              placeholder={t("slugPlaceholder")}
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
            />
            <Button
              className="self-start"
              onClick={handleCreateOrg}
              disabled={isCreating || !orgName.trim() || !orgSlug.trim()}
            >
              {isCreating ? t("creating") : t("createButton")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Has org — show details + members
  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <PageHeader
        title={t("title")}
        subtitle={activeOrg.name}
        actions={
          currentUserRole === "owner" ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              {t("inviteMember")}
            </Button>
          ) : undefined
        }
      />

      {/* Org details */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10">
            <Building2 className="w-6 h-6 text-accent" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold text-text-primary">
              {activeOrg.name}
            </span>
            <span className="text-sm text-text-muted">{activeOrg.slug}</span>
          </div>
          <Badge variant="info" className="ml-auto">
            {members.length} {t("membersCount")}
          </Badge>
        </div>
      </Card>

      {/* Members */}
      <Card>
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-text-primary">
            {t("members")}
          </h3>
          <div className="flex flex-col">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 py-3 border-b border-border-default last:border-0"
              >
                <Avatar
                  initials={deriveInitials(member.user.name)}
                  size="sm"
                  src={member.user.image ?? undefined}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {member.user.name}
                  </span>
                  <span className="text-xs text-text-muted truncate">
                    {member.user.email}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  {roleIcon(member.role)}
                  <span className="text-xs font-medium">
                    {roleLabel(member.role)}
                  </span>
                </div>
                {member.role !== "owner" && currentUserRole === "owner" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        {t("removeMember")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Pending invitations */}
      {invitations.filter((inv) => inv.status === "pending").length > 0 && (
        <Card>
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-text-primary">
              {t("pendingInvitations")}
            </h3>
            <div className="flex flex-col">
              {invitations
                .filter((inv) => inv.status === "pending")
                .map((inv) => (
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
                        {roleLabel(inv.role ?? "member")}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {(() => {
                        const days = Math.ceil(
                          (new Date(inv.expiresAt).getTime() - Date.now()) /
                            86400000
                        );
                        if (days < 0) return t("expired");
                        if (days === 0) return t("expiresToday");
                        return t("expiresIn", { count: days });
                      })()}
                    </span>
                    <Badge variant="warning">{t("pending")}</Badge>
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      className="text-xs text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                    >
                      {tc("cancel")}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteEmail("");
            setInviteRole("member");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inviteTitle")}</DialogTitle>
            <DialogDescription>{t("inviteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Input
              label={t("inviteEmail")}
              type="email"
              placeholder={t("inviteEmailPlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                {t("inviteRoleLabel")}
              </label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("rolePM")}</SelectItem>
                  <SelectItem value="member">{t("roleArchitect")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setInviteOpen(false)}
              disabled={isInviting}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={
                isInviting ||
                !inviteEmail.trim() ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())
              }
            >
              {isInviting ? t("sending") : t("sendInvite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
