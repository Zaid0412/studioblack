"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, LogOut, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarUtils";
import { useUserRole } from "@/hooks/useUserRole";
import { signOutAndReset } from "@/lib/auth-actions";
import type { User } from "@/types";

interface AvatarMenuProps {
  user: User;
}

/** Avatar button that opens a profile dropdown with settings, org, and logout. */
export function AvatarMenu({ user }: AvatarMenuProps) {
  const router = useRouter();
  const t = useTranslations("nav");
  const { role } = useUserRole();
  const isStaff = role === "pm" || role === "architect";
  const color = avatarColor(user.id);

  const handleLogout = async () => {
    await signOutAndReset();
    router.push("/login");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="shrink-0 cursor-pointer rounded-full">
          <Avatar
            initials={user.initials}
            size="sm"
            src={user.avatar}
            color={color}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[220px] p-0 border-border-default bg-bg-primary rounded-xl overflow-hidden"
      >
        {/* Profile header */}
        <div className="flex flex-col items-center gap-1 px-4 pt-5 pb-4">
          <Avatar
            initials={user.initials}
            size="xl"
            src={user.avatar}
            color={color}
          />
          <span className="text-sm font-semibold text-text-primary mt-2">
            {user.name}
          </span>
          <span className="text-xs text-text-muted">{user.email}</span>
        </div>

        <div className="h-px bg-border-default" />

        {/* Menu items */}
        <div className="py-1.5">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-[15px] font-semibold text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
          >
            <Settings className="w-5 h-5 text-text-primary" />
            {t("settings")}
          </button>
          {isStaff && (
            <button
              onClick={() => router.push("/settings?section=organization")}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-[15px] font-semibold text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
            >
              <Building2 className="w-5 h-5 text-text-primary" />
              {t("organisation")}
            </button>
          )}
        </div>

        <div className="h-px bg-border-default" />

        {/* Logout */}
        <div className="py-1.5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-[15px] font-semibold text-error hover:bg-danger-muted transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            {t("logout")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
