/**
 * `/dashboard` is a role-specific root shared by studio and vendor nav. Prefix-
 * matching it would keep the Dashboard tab active on unrelated leaf routes, so
 * it needs exact match. (The vendor feature tabs — /rfqs etc. — use the default
 * prefix match so a detail page like /rfqs/123 still highlights the RFQs tab.)
 */
const EXACT_MATCH_ROUTES = new Set(["/dashboard"]);

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
