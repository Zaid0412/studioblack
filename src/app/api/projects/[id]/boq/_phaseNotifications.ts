import {
  getEligibleReviewers,
  getLastPhaseActors,
  getProjectClientInfo,
  getUsersByIds,
} from "@/lib/queries";
import { createNotification } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { BoqItemPhase } from "@/lib/validations";

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
      // De-dup the recipient set and skip the acting approver.
      const submitters = await getLastPhaseActors(itemIds, "internal_review");
      const recipients = new Set<string>();
      if (boqCreatorId) recipients.add(boqCreatorId);
      for (const userId of submitters.values()) recipients.add(userId);
      recipients.delete(actor.id);
      if (recipients.size === 0) return;
      await fanOutToUsers([...recipients], {
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
      if (!boqCreatorId || boqCreatorId === actor.id) return;
      await fanOutToUsers([boqCreatorId], {
        notificationType: `boq_item_${target}`,
        projectId,
        title,
        desc,
      });
      return;
    }
    case "sent_to_client": {
      const client = await getProjectClientInfo(projectId);
      if (!client?.client_email) return;
      const html = `<p>${escapeHtml(actorName)} sent ${escapeHtml(noun)} on <strong>${escapeHtml(boqTitle)}</strong> for your review.</p>${
        comment ? `<p style="color: #666;">${escapeHtml(comment)}</p>` : ""
      }`;
      sendNotificationEmail(client.client_email, title, html).catch((err) =>
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
