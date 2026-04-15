"use client";

import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import type { User } from "@/types";

interface MobileShellProps {
  user: User;
}

/** Mobile navigation shell: top bar and bottom nav. */
export function MobileShell({ user }: MobileShellProps) {
  return (
    <>
      <MobileTopBar user={user} />
      <MobileBottomNav />
    </>
  );
}
