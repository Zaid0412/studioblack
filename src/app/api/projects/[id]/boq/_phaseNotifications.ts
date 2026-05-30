import {
  getBoqItemsForPdf,
  getEligibleReviewers,
  getLastPhaseActors,
  getProjectStaffIds,
  getUsersByIds,
} from "@/lib/queries";
import { createNotification } from "@/lib/notifications";
import {
  escapeHtml,
  sendClientBoqEmail,
  sendNotificationEmail,
} from "@/lib/email";
import { logger } from "@/lib/logger";
import { env } from "@/env";
import { buildBoqPdfFilename, renderBoqPdf } from "@/lib/boq/pdf";
import type { BoqItemPhase } from "@/lib/validations";

/** Skip PDF generation past this size — protects against pathological BOQs. */
const PDF_MAX_ITEMS = 500;

/**
 * Fan-out for per-item phase notifications, shared between the single-item
 * and bulk-item lifecycle routes. Behaviour:
 *
 * - Recipients depend on `target` (see switch below).
 * - Reviewer / creator emails are batched into one `getUsersByIds` round-trip
 *   instead of one DB lookup per recipient (avoids N+1 on bulk fan-outs).
 * - All sends are fire-and-forget — errors are logged, never thrown.
 * - Title wording adapts to `itemCount` ("item" vs "N items") so both call
 *   sites share the same body.
 */
export async function notifyPhaseRecipients(opts: {
  projectId: string;
  orgId: string | null;
  boqId: string;
  boqTitle: string;
  boqCreatorId: string | null;
  target: BoqItemPhase;
  itemIds: readonly string[];
  actor: { id: string; name?: string | null; email?: string | null };
  comment: string | null;
}): Promise<void> {
  const {
    projectId,
    orgId,
    boqId,
    boqTitle,
    boqCreatorId,
    target,
    itemIds,
    actor,
    comment,
  } = opts;
  const actorName = actor.name || actor.email || "A teammate";
  const noun = itemIds.length === 1 ? "item" : `${itemIds.length} items`;
  const title = phaseTitle(target, boqTitle, noun);
  const desc = comment
    ? `${actorName} — ${comment}`
    : `${actorName} updated ${noun} to ${target.replace(/_/g, " ")}.`;

  switch (target) {
    case "internal_review": {
      if (!orgId) return;
      const reviewerIds = await getEligibleReviewers({
        orgId,
        creatorId: actor.id,
      });
      await fanOutToUsers(reviewerIds, {
        notificationType: "boq_item_review_requested",
        projectId,
        title,
        desc,
      });
      return;
    }
    case "internally_approved": {
      // Notify the BOQ creator AND whoever fired `internal_review` on each
      // item — the submitter may not be the creator (any PM can submit).
      const submitters = await getLastPhaseActors(itemIds, "internal_review");
      await fanOutWithCreator({
        base: submitters.values(),
        creatorId: boqCreatorId,
        actorId: actor.id,
        notificationType: `boq_item_${target}`,
        projectId,
        title,
        desc,
      });
      return;
    }
    case "client_approved":
    case "client_changes_requested":
    case "internal_changes_requested": {
      // Whole studio team on the project (every PM + architect in
      // `project_member`) plus the BOQ creator if they're somehow not a
      // member. Actor excluded.
      const staffIds = await getProjectStaffIds(projectId);
      await fanOutWithCreator({
        base: staffIds,
        creatorId: boqCreatorId,
        actorId: actor.id,
        notificationType: `boq_item_${target}`,
        projectId,
        title,
        desc,
      });
      return;
    }
    case "sent_to_client": {
      const pdfData = await getBoqItemsForPdf(boqId, itemIds).catch((err) => {
        logger.warn("BOQ PDF data fetch failed", { error: err });
        return null;
      });
      if (!pdfData?.project.client_email) return;

      // Past the cap we still email + CTA, just no PDF — protects against
      // multi-MB attachments and very slow renders on pathological BOQs.
      let pdfBuffer: Buffer | null = null;
      let pdfFilename = "BoQ.pdf";
      if (pdfData.items.length > 0 && pdfData.items.length <= PDF_MAX_ITEMS) {
        try {
          pdfBuffer = await renderBoqPdf({
            projectName: pdfData.project.name,
            boqTitle: pdfData.boq.title,
            currency: pdfData.boq.currency,
            comment,
            items: pdfData.items,
          });
          pdfFilename = buildBoqPdfFilename(pdfData.project.name);
        } catch (err) {
          logger.error("BOQ PDF render failed", { error: err });
        }
      }

      const portalUrl = `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/projects/${projectId}/boq`;
      const bodyHtml = `<p>${escapeHtml(actorName)} sent ${escapeHtml(noun)} on <strong>${escapeHtml(boqTitle)}</strong> for your review.</p>${
        comment ? `<p style="color: #666;">${escapeHtml(comment)}</p>` : ""
      }`;

      sendClientBoqEmail({
        to: pdfData.project.client_email,
        subject: title,
        bodyHtml,
        portalUrl,
        pdfBuffer,
        pdfFilename,
      }).catch((err) =>
        logger.error("Client phase email failed", { error: err })
      );
      return;
    }
    // `client_reviewing` is set automatically when the client opens the
    // BOQ — no notification fires. `draft` is a silent rollback.
    case "client_reviewing":
    case "draft":
      return;
  }
}

/**
 * De-dup recipients (creator + base set, minus actor), then fan out.
 * No-op when the resulting set is empty.
 */
async function fanOutWithCreator(opts: {
  base: Iterable<string>;
  creatorId: string | null;
  actorId: string;
  notificationType: string;
  projectId: string;
  title: string;
  desc: string;
}): Promise<void> {
  const recipients = new Set<string>(opts.base);
  if (opts.creatorId) recipients.add(opts.creatorId);
  recipients.delete(opts.actorId);
  if (recipients.size === 0) return;
  await fanOutToUsers([...recipients], {
    notificationType: opts.notificationType,
    projectId: opts.projectId,
    title: opts.title,
    desc: opts.desc,
  });
}

/** Single batched DB lookup, then one in-app + email per recipient. */
async function fanOutToUsers(
  userIds: string[],
  opts: {
    notificationType: string;
    projectId: string;
    title: string;
    desc: string;
  }
): Promise<void> {
  if (userIds.length === 0) return;
  const users = (await getUsersByIds(userIds)) as Array<{
    id: string;
    email: string | null;
  }>;
  for (const u of users) {
    createNotification({
      userId: u.id,
      type: opts.notificationType,
      title: opts.title,
      description: opts.desc,
      projectId: opts.projectId,
    }).catch(() => {});
    if (u.email) {
      sendNotificationEmail(u.email, opts.title, opts.desc).catch((err) =>
        logger.error("Phase fan-out email failed", { userId: u.id, error: err })
      );
    }
  }
}

// No `default` case: BoqItemPhase is exhaustive, so TS flags new phases
// at compile time. Adding a default would silently swallow them.
function phaseTitle(
  target: BoqItemPhase,
  boqTitle: string,
  noun: string
): string {
  switch (target) {
    case "internal_review":
      return `BOQ ${noun} submitted for review: ${boqTitle}`;
    case "internally_approved":
      return `BOQ ${noun} internally approved: ${boqTitle}`;
    case "sent_to_client":
      return `BOQ ${noun} sent to client: ${boqTitle}`;
    case "client_reviewing":
      return `BOQ ${noun} now under client review: ${boqTitle}`;
    case "client_approved":
      return `BOQ ${noun} approved by client: ${boqTitle}`;
    case "client_changes_requested":
      return `BOQ ${noun} — client requested changes: ${boqTitle}`;
    case "internal_changes_requested":
      return `BOQ ${noun} — changes requested: ${boqTitle}`;
    case "draft":
      return `BOQ ${noun} moved back to draft: ${boqTitle}`;
  }
}
