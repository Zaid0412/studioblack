"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  History,
  Briefcase,
  Layers,
  FileText,
  Receipt,
  ScrollText,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useFlag } from "@/hooks/useFlag";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useDismissOnEscape } from "@/hooks/useDismissOnEscape";
import { isActiveRoute } from "@/lib/nav";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/types";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, only these roles see the tab. */
  roles?: UserRole[];
}

/**
 * Primary tab cap before overflow. iOS HIG / Material both top out around 5
 * destinations; we render 4 primary + a "More" button so the More icon
 * always has the same slot regardless of role.
 */
const PRIMARY_LIMIT = 4;

/**
 * Drag distance below which a pointerup is treated as a tap (toggles the
 * sheet) rather than a drag (snaps based on direction).
 */
const DRAG_TAP_THRESHOLD_PX = 5;

/** Persistent bottom navigation bar for mobile viewports. */
export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { role } = useUserRole();
  const vendorManagementEnabled = useFlag("vendorManagement");
  const elementLibraryEnabled = useFlag("elementLibrary");
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = useMemo(() => {
    if (role === "vendor") {
      return [
        {
          href: "/vendor-portal",
          label: t("vendorDashboard"),
          icon: LayoutDashboard,
        },
        { href: "/vendor-portal/rfqs", label: t("rfqs"), icon: FileText },
        {
          href: "/vendor-portal/purchase-orders",
          label: t("purchaseOrders"),
          icon: ScrollText,
        },
        {
          href: "/vendor-portal/invoices",
          label: t("invoices"),
          icon: Receipt,
        },
      ] satisfies Tab[];
    }

    const allTabs: Tab[] = [
      { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
      { href: "/projects", label: t("projects"), icon: FolderOpen },
      {
        href: "/tasks",
        label: t("tasks"),
        icon: CheckSquare,
        roles: ["pm", "architect"] satisfies UserRole[],
      },
      ...(elementLibraryEnabled
        ? [
            {
              href: "/elements/library",
              label: t("elements"),
              icon: Layers,
              roles: ["pm", "architect"] satisfies UserRole[],
            },
          ]
        : []),
      ...(vendorManagementEnabled
        ? [
            {
              href: "/vendors",
              label: t("vendors"),
              icon: Briefcase,
              roles: ["pm", "architect"] satisfies UserRole[],
            },
          ]
        : []),
      {
        href: "/audit",
        label: t("audit"),
        icon: History,
        roles: ["pm"] satisfies UserRole[],
      },
    ];
    return allTabs.filter(
      (tab) => !tab.roles || (role && tab.roles.includes(role))
    );
  }, [role, t, elementLibraryEnabled, vendorManagementEnabled]);

  const [primaryTabs, overflowTabs] = useMemo(() => {
    if (tabs.length <= PRIMARY_LIMIT + 1) return [tabs, [] as Tab[]];
    return [tabs.slice(0, PRIMARY_LIMIT), tabs.slice(PRIMARY_LIMIT)];
  }, [tabs]);

  const moreActive =
    overflowTabs.length > 0 &&
    overflowTabs.some((tab) => isActiveRoute(pathname, tab.href));

  // Close the sheet whenever navigation happens — the user either tapped
  // an overflow item (success) or moved on (no longer relevant).
  // The React 19 `set-state-in-effect` rule recommends `useSyncExternalStore`
  // or a route-keyed remount, both of which are wrong tools here — we just
  // want a side effect on a prop change. Disable is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMoreOpen(false), [pathname]);
  useDismissOnEscape(moreOpen, () => setMoreOpen(false));

  // Live-drag the overflow sheet: while the user holds the pill, the
  // visible overflow height tracks their finger 1:1. On release, snap to
  // open or closed based on whether they crossed the halfway mark.
  const overflowRef = useRef<HTMLUListElement>(null);
  const [overflowH, setOverflowH] = useState(0);
  // ResizeObserver keeps the snap-target height fresh across rotation,
  // viewport resize, font scaling, and feature-flag-driven item changes.
  // Setting `overflowTabs.length` as the only dep would miss those.
  useEffect(() => {
    const el = overflowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverflowH(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Expose the current rendered nav height as `--mobile-nav-h` on the
  // document root so the dashboard `<main>` can grow its bottom padding
  // when the sheet expands. Without this, the bottom ~visible-overflow
  // pixels of page content sit under the open sheet and become
  // unreachable.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--mobile-nav-h",
        `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--mobile-nav-h");
    };
  }, []);

  const [drag, setDrag] = useState<{
    startY: number;
    base: number;
    delta: number;
  } | null>(null);
  // rAF gate keeps pointermove → setDrag at ~1 commit per frame instead
  // of 1 per raw event. Cleared on drag end so the next gesture starts
  // fresh.
  const moveRafRef = useRef<number | null>(null);
  const visualHeight = drag
    ? Math.max(0, Math.min(overflowH, drag.base - drag.delta))
    : moreOpen
      ? overflowH
      : 0;

  // Pointer events (rather than touch) so the same code path handles
  // mouse drags in DevTools emulation, trackpad drags on desktop, and
  // real finger drags on phones. setPointerCapture keeps the move
  // events flowing even when the finger leaves the pill's hit area.
  const handleDragStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      startY: e.clientY,
      base: moreOpen ? overflowH : 0,
      delta: 0,
    });
  };
  const handleDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const y = e.clientY;
    if (moveRafRef.current !== null) return;
    moveRafRef.current = window.requestAnimationFrame(() => {
      moveRafRef.current = null;
      setDrag((cur) => (cur ? { ...cur, delta: y - cur.startY } : cur));
    });
  };
  const cancelMoveRaf = () => {
    if (moveRafRef.current !== null) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
  };
  const releaseCapture = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const handleDragEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseCapture(e);
    cancelMoveRaf();
    if (!drag) return;
    // Tap (finger barely moved) → toggle. We handle this here instead of
    // via onClick: pointer events with setPointerCapture still emit the
    // synthetic click, and an onClick handler would double-toggle right
    // after our snap setMoreOpen.
    if (Math.abs(drag.delta) < DRAG_TAP_THRESHOLD_PX) {
      setMoreOpen((v) => !v);
      setDrag(null);
      return;
    }
    const projected = drag.base - drag.delta;
    setMoreOpen(projected > overflowH / 2);
    setDrag(null);
  };
  // A system-cancelled gesture (incoming call, drag-from-edge, etc.)
  // must NOT count as a tap, otherwise the sheet would silently toggle.
  // Reset state without consulting the delta.
  const handleDragCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseCapture(e);
    cancelMoveRaf();
    setDrag(null);
  };

  const hasOverflow = overflowTabs.length > 0;
  return (
    <>
      {/* Backdrop dims everything above the nav. The nav (z-40) overlaps
          the bottom of the backdrop (z-30), so the primary tabs + the
          expanded overflow stay clear. */}
      {hasOverflow && (
        <div
          onClick={() => setMoreOpen(false)}
          aria-hidden
          className={cn(
            "fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 lg:hidden",
            moreOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}

      {/* Nav + overflow share one container anchored to bottom-0. When
          open, the overflow's grid row expands and the whole container
          grows upward — so the primary-tabs row visually sits at the
          top of the revealed sheet, with the overflow items below it. */}
      <nav
        ref={navRef}
        className="fixed bottom-0 inset-x-0 z-40 bg-bg-primary border-t border-border-default pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={t("dashboard")}
      >
        {hasOverflow && (
          <button
            type="button"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragCancel}
            aria-label={moreOpen ? t("close") : t("more")}
            aria-expanded={moreOpen}
            className="flex justify-center w-full pt-2.5 pb-3 cursor-grab active:cursor-grabbing touch-none"
          >
            <span
              aria-hidden
              className={cn(
                "block w-14 h-1 rounded-full transition-colors",
                moreOpen ? "bg-text-muted" : "bg-border-default"
              )}
            />
          </button>
        )}
        <div className="flex items-center justify-around h-14">
          {primaryTabs.map((tab) => (
            <TabLink
              key={tab.href}
              tab={tab}
              active={isActiveRoute(pathname, tab.href)}
            />
          ))}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label={moreOpen ? t("close") : t("more")}
              className={cn(
                // Only treat the current-route match as "active". The
                // open state is conveyed by the icon+label swap, so the
                // selected primary tab stays the only accented item.
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors cursor-pointer",
                moreActive ? "text-accent" : "text-text-muted"
              )}
            >
              {moreOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <MoreHorizontal className="w-5 h-5" />
              )}
              <span className="text-[10px] font-medium">
                {moreOpen ? t("close") : t("more")}
              </span>
            </button>
          )}
        </div>
        {hasOverflow && (
          <div
            style={{ height: visualHeight }}
            className={cn(
              "overflow-hidden",
              // No transition during the drag — the height tracks the
              // finger directly. Snap-to-rest animates after touchend.
              drag === null && "transition-[height] duration-[250ms] ease-out"
            )}
            aria-hidden={!moreOpen && drag === null}
          >
            <ul
              ref={overflowRef}
              className="flex flex-col px-2 pt-1 pb-2 border-t border-border-default"
            >
              {overflowTabs.map((tab) => (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    tabIndex={moreOpen ? 0 : -1}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                      isActiveRoute(pathname, tab.href)
                        ? "bg-bg-elevated text-accent"
                        : "text-text-primary hover:bg-bg-elevated/60"
                    )}
                  >
                    <tab.icon
                      className={cn(
                        "w-5 h-5",
                        isActiveRoute(pathname, tab.href)
                          ? "text-accent"
                          : "text-text-muted"
                      )}
                    />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
        active ? "text-accent" : "text-text-muted"
      )}
    >
      <tab.icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{tab.label}</span>
    </Link>
  );
}
