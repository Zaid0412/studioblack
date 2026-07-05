import { bulkCreateCategoriesFromTemplates } from "@/lib/queries";
import { MASTER_TAXONOMY } from "@/lib/categoryTemplates";
import type { BulkCategoryNode } from "@/lib/validations";

/**
 * Provision a newly-created organisation with its default data.
 *
 * Currently seeds the shared master taxonomy (Category → Sub-category →
 * Service Area) so every org has categories out of the box. Idempotent — safe
 * to re-run, e.g. to backfill an org that predates auto-seeding.
 *
 * This is the single provisioning entry point: the `afterCreateOrganization`
 * auth hook calls it for the app's normal org-creation flow, and any script,
 * admin action, or backfill that creates orgs by other means should call it too
 * so "a new org has default categories" stays a property of one code path
 * rather than logic duplicated per call site. Extend here as more per-org
 * defaults are added (default project, settings, …).
 */
export async function provisionNewOrg(orgId: string): Promise<void> {
  await bulkCreateCategoriesFromTemplates(
    orgId,
    MASTER_TAXONOMY as readonly BulkCategoryNode[]
  );
}
