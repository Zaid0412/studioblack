/**
 * `/dashboard` and `/vendor-portal` are role-specific roots that contain
 * many sub-routes. Prefix-matching them would highlight both the root
 * tab and the active leaf tab simultaneously, so they need exact match.
 */
const EXACT_MATCH_ROUTES = new Set(["/dashboard", "/vendor-portal"]);

/**
 * Shared nav active-state check. A tab is active when the current
 * pathname equals its href, or when the pathname is a sub-route of the
 * href and the href isn't one of the role dashboards.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (EXACT_MATCH_ROUTES.has(href)) return false;
  return pathname.startsWith(href + "/");
}
