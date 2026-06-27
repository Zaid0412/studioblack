/**
 * Barrel re-export. Consumers import `from "@/lib/queries"`; query implementations
 * live in the sibling domain files.
 *
 * `./helpers` is intentionally NOT re-exported — `escapeSqlLike` and
 * `generateBetterAuthId` are internal utilities for the query layer itself.
 */
export * from "./roles";
export * from "./users";
export * from "./projects";
export * from "./phaseTasks";
export * from "./tasks";
export * from "./taskAttachments";
export * from "./taskComments";
export * from "./taskActivity";
export * from "./checklists";
export * from "./attachments";
export * from "./attachmentReviews";
export * from "./comments";
export * from "./pinComments";
export * from "./notifications";
export * from "./dashboard";
export * from "./emailChange";
export * from "./approvals";
export * from "./elements";
export * from "./elementCategories";
export * from "./boq";
export * from "./vendors";
export * from "./rateContracts";
export * from "./rfqs";
export * from "./quotes";
export * from "./audit";
export * from "./projectDocuments";
