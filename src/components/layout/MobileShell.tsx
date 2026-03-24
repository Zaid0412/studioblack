"use client";

import { useState } from "react";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileSidebarSheet } from "./MobileSidebarSheet";
import type { User } from "@/types";

interface MobileShellProps {
  user: User;
  variant: "pm" | "architect" | "client";
}

/** Mobile navigation shell: top bar, bottom nav, and slide-out sidebar sheet. */
export function MobileShell({ user, variant }: MobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <MobileTopBar user={user} onMenuOpen={() => setSidebarOpen(true)} />
      <MobileBottomNav />
      <MobileSidebarSheet
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant={variant}
      />
    </>
  );
}
