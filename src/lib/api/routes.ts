/**
 * Central route map — single source of truth for all API URLs.
 *
 * STRUCTURE
 * ─────────────────────────────────────────────────
 * projects         /api/projects
 *   ├─ attachments   /api/projects/:id/attachments
 *   ├─ versions      /api/projects/:id/versions
 *   ├─ comments      /api/projects/:id/comments
 *   ├─ approvals     /api/projects/:id/approvals
 *   └─ tasks review  /api/projects/:id/tasks/:taskId/review
 *
 * tasks            /api/tasks
 *   ├─ checklist     /api/tasks/:id/checklist
 *   └─ attachments   /api/tasks/:id/attachments
 *
 * notifications    /api/notifications
 * upload           /api/upload/signed-url, /api/avatar, /api/proxy-file
 * dashboard        /api/dashboard
 * client           /api/client/projects
 * ─────────────────────────────────────────────────
 */
export const API = {
  // ── Projects ────────────────────────────────────
  projects:              ()                            => "/api/projects",
  project:               (id: string)                  => `/api/projects/${id}`,

  // ── Project → Attachments ──────────────────────
  attachments:           (pid: string)                 => `/api/projects/${pid}/attachments`,
  attachment:            (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}`,
  attachmentReview:      (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/review`,
  attachmentFreeze:      (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/freeze`,
  attachmentUnfreeze:    (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/unfreeze`,
  attachmentSendToClient:(pid: string, fid: string)               => `/api/projects/${pid}/attachments/${fid}/send-to-client`,
  attachmentPins:        (pid: string, fid: string)               => `/api/projects/${pid}/attachments/${fid}/pins`,
  attachmentPin:         (pid: string, fid: string, pinId: string) => `/api/projects/${pid}/attachments/${fid}/pins/${pinId}`,
  attachmentPinReplies:  (pid: string, fid: string, pinId: string) => `/api/projects/${pid}/attachments/${fid}/pins/${pinId}/replies`,

  // ── Project → Versions ─────────────────────────
  versionHistory:        (pid: string, group: string)  => `/api/projects/${pid}/versions/${group}`,

  // ── Project → Comments / Approvals ─────────────
  comments:              (pid: string)                 => `/api/projects/${pid}/comments`,
  approvals:             (pid: string)                 => `/api/projects/${pid}/approvals`,

  // ── Project → Task Review ──────────────────────
  taskReview:            (pid: string, tid: string)    => `/api/projects/${pid}/tasks/${tid}/review`,
  tasksPendingReview:    (pid: string)                 => `/api/projects/${pid}/tasks/pending-review`,

  // ── Tasks ───────────────────────────────────────
  tasks:                 ()                            => "/api/tasks",
  taskCounts:            ()                            => "/api/tasks/counts",
  task:                  (id: string)                  => `/api/tasks/${id}`,
  taskStar:              (id: string)                  => `/api/tasks/${id}/star`,

  // ── Task → Checklist ───────────────────────────
  taskChecklist:         (tid: string)                 => `/api/tasks/${tid}/checklist`,
  taskChecklistItem:     (tid: string, iid: string)    => `/api/tasks/${tid}/checklist/${iid}`,
  taskChecklistReorder:  (tid: string)                 => `/api/tasks/${tid}/checklist/reorder`,

  // ── Task → Attachments ─────────────────────────
  taskAttachments:       (tid: string)                 => `/api/tasks/${tid}/attachments`,
  taskAttachment:        (tid: string, aid: string)    => `/api/tasks/${tid}/attachments/${aid}`,

  // ── Task → Comments ────────────────────────────
  taskComments:          (tid: string)                 => `/api/tasks/${tid}/comments`,
  taskComment:           (tid: string, cid: string)    => `/api/tasks/${tid}/comments/${cid}`,

  // ── Task → Activity (merged comments + audit events) ──
  taskActivity:          (tid: string)                 => `/api/tasks/${tid}/activity`,

  // ── Notifications ──────────────────────────────
  notifications:         ()                            => "/api/notifications",

  // ── Upload & Files ─────────────────────────────
  uploadSignedUrl:       ()                            => "/api/upload/signed-url",
  avatar:                ()                            => "/api/avatar",
  proxyFile:             (url: string)                 => `/api/proxy-file?url=${encodeURIComponent(url)}`,

  // ── Dashboard ──────────────────────────────────
  dashboard:             ()                            => "/api/dashboard",
  dashboardPendingReviews: ()                          => "/api/dashboard/pending-reviews",

  // ── Settings ───────────────────────────────────
  changeEmail:           ()                            => "/api/settings/change-email",
  verifyEmailChange:     ()                            => "/api/settings/verify-email-change",

  // ── Element Categories ──────────────────────────
  elementCategories:        ()                            => "/api/element-categories",
  elementCategory:          (id: string)                  => `/api/element-categories/${id}`,
  elementCategoriesReorder: ()                            => "/api/element-categories/reorder",
  elementCategoriesBulk:    ()                            => "/api/element-categories/bulk",

  // ── Elements ────────────────────────────────────
  elements:                 ()                            => "/api/elements",
  element:                  (id: string)                  => `/api/elements/${id}`,
  elementDuplicate:         (id: string)                  => `/api/elements/${id}/duplicate`,
  elementRestore:           (id: string)                  => `/api/elements/${id}/restore`,
  elementVersions:          (id: string)                  => `/api/elements/${id}/versions`,
  elementsImport:           ()                            => "/api/elements/import",
  elementsImportConfirm:    ()                            => "/api/elements/import/confirm",
  elementsImportTemplate:   ()                            => "/api/elements/import/template",
  elementsExport:           (qs: string)                  => `/api/elements/export${qs}`,

  // ── Client Portal ──────────────────────────────
  clientProjects:        ()                            => "/api/client/projects",

  // ── BOQ (Feature 4) ─────────────────────────────
  boq:                   (pid: string)                       => `/api/projects/${pid}/boq`,
  boqSummary:            (pid: string)                       => `/api/projects/${pid}/boq/summary`,
  boqSections:           (pid: string)                       => `/api/projects/${pid}/boq/sections`,
  boqSection:            (pid: string, sid: string)          => `/api/projects/${pid}/boq/sections/${sid}`,
  boqSectionsReorder:    (pid: string)                       => `/api/projects/${pid}/boq/sections/reorder`,
  boqItems:              (pid: string)                       => `/api/projects/${pid}/boq/items`,
  boqItem:               (pid: string, iid: string)          => `/api/projects/${pid}/boq/items/${iid}`,
  boqItemMove:           (pid: string, iid: string)          => `/api/projects/${pid}/boq/items/${iid}/move`,
  boqItemsBulkMove:      (pid: string)                       => `/api/projects/${pid}/boq/items/bulk-move`,
  boqItemsBulkDelete:    (pid: string)                       => `/api/projects/${pid}/boq/items/bulk-delete`,
  boqItemsReorder:       (pid: string)                       => `/api/projects/${pid}/boq/items/reorder`,
  boqItemsFromElement:   (pid: string)                       => `/api/projects/${pid}/boq/items/from-element`,
  boqItemsFromElements:  (pid: string)                       => `/api/projects/${pid}/boq/items/from-elements`,

  // ── Per-item lifecycle phase (Pap's 2026-05-12 spec) ─
  boqItemLifecycle:      (pid: string, iid: string)          => `/api/projects/${pid}/boq/items/${iid}/lifecycle`,
  boqItemsBulkLifecycle: (pid: string)                       => `/api/projects/${pid}/boq/items/bulk-lifecycle`,

  // ── BOQ Excel Import / Export (Feature 6) ───────
  boqImport:             (pid: string)                       => `/api/projects/${pid}/boq/import`,
  boqImportConfirm:      (pid: string)                       => `/api/projects/${pid}/boq/import/confirm`,
  boqExport:             (pid: string)                       => `/api/projects/${pid}/boq/export`,

  // ── Vendors (Feature 7) ─────────────────────────
  vendors:               ()                            => "/api/vendors",
  vendor:                (id: string)                  => `/api/vendors/${id}`,
  vendorBankDetails:     (id: string)                  => `/api/vendors/${id}/bank-details`,
  vendorRating:          (id: string)                  => `/api/vendors/${id}/rating`,
  vendorContactInvite:   (id: string, contactId: string) => `/api/vendors/${id}/contacts/${contactId}/invite`,
  vendorsByTrade:        (categoryId: string)          => `/api/vendors/by-trade/${categoryId}`,

  // ── Vendor KYC (Feature 7.1) ────────────────────
  vendorKycDocuments:    (id: string)                  => `/api/vendors/${id}/kyc-documents`,
  vendorKycDocument:     (id: string, docId: string)   => `/api/vendors/${id}/kyc-documents/${docId}`,
  vendorKycStatus:       (id: string)                  => `/api/vendors/${id}/kyc-status`,

  // ── Vendor Portal — Self-Service (Feature 8.5) ─
  vendorPortalMe:              ()                       => "/api/vendor-portal/me",
  vendorPortalBankDetails:     ()                       => "/api/vendor-portal/me/bank-details",
  vendorPortalKycDocuments:    ()                       => "/api/vendor-portal/me/kyc-documents",
  vendorPortalKycDocument:     (docId: string)          => `/api/vendor-portal/me/kyc-documents/${docId}`,
  vendorPortalContacts:        ()                       => "/api/vendor-portal/me/contacts",
  vendorPortalContact:         (contactId: string)      => `/api/vendor-portal/me/contacts/${contactId}`,

  // ── Rate Contracts (Feature 7.5) ────────────────
  rateContracts:               ()                                    => "/api/rate-contracts",
  rateContract:                (id: string)                          => `/api/rate-contracts/${id}`,
  rateContractItems:           (id: string)                          => `/api/rate-contracts/${id}/items`,
  rateContractItem:            (id: string, itemId: string)          => `/api/rate-contracts/${id}/items/${itemId}`,
  rateContractActivate:        (id: string)                          => `/api/rate-contracts/${id}/activate`,
  rateContractsByElement:      (elementId: string)                   => `/api/rate-contracts/by-element/${elementId}`,
  rateContractAvailableRates:  ()                                    => "/api/rate-contracts/available-rates",
} as const;
