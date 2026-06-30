/**
 * `/dashboard` and `/vendor-portal` are role-specific roots that contain
 * many sub-routes. Prefix-matching them would highlight both the root
 * tab and the active leaf tab simultaneously, so they need exact match.
 */
const EXACT_MATCH_ROUTES = new Set(["/dashboard", "/vendor-portal"]);

/**
 * Shared nav active-state check. A tab is active when the current pathname
 * equals its match route, or is a sub-route of it (and it isn't a role
 * dashboard). `activeHref` overrides `href` for matching when an item should
 * be active across a broader section than it links to — e.g. Elements links
 * to `/elements/library` but is active across all of `/elements`.
 */
export function isActiveRoute(
  pathname: string,
  href: string,
  activeHref?: string
): boolean {
  const matchHref = activeHref ?? href;
  if (pathname === matchHref) return true;
  if (EXACT_MATCH_ROUTES.has(matchHref)) return false;
  return pathname.startsWith(matchHref + "/");
}
