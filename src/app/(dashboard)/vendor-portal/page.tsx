import { redirect } from "next/navigation";

/**
 * The vendor dashboard moved to /dashboard (role-routed, like the client one).
 * Redirect the old bare /vendor-portal entry there; the sub-pages (rfqs / POs /
 * invoices / progress / profile) still live under /vendor-portal/*. When the
 * `vendorPortal` flag is off, the layout renders its coming-soon panel and this
 * never runs — matching the /dashboard vendor gate.
 */
export default function VendorPortalIndex() {
  redirect("/dashboard");
}
