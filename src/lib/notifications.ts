import { getPool } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * The entity a notification is about, used to deep-link it. Pass the most
 * specific one available — `notificationDestination` routes on it.
 *
 * `taskId` is a `task` row (what /tasks/{id} serves), NOT a `phase_task`. The
 * two are different tables and the foreign key rejects the wrong one.
 */
export interface NotificationEntities {
  taskId?: string;
  rfqId?: string;
  attachmentId?: string;
}

interface CreateNotificationInput extends NotificationEntities {
  userId: string;
  type: string;
  title: string;
  description?: string;
  projectId?: string;
}

/** Fixed order, shared by every INSERT's entity columns. */
function entityValues(e: NotificationEntities) {
  return [e.taskId || null, e.rfqId || null, e.attachmentId || null];
}

/** Create a single notification record. */
export async function createNotification(input: CreateNotificationInput) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notification (user_id, type, title, description, project_id, task_id, rfq_id, attachment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.userId,
      input.type,
      input.title,
      input.description || "",
      input.projectId || null,
      ...entityValues(input),
    ]
  );
}

/** Create notifications for all team members on a project (excluding a specific user). */
export async function createNotificationsForTeam(
  projectId: string,
  excludeUserId: string,
  type: string,
  title: string,
  description?: string,
  entities: NotificationEntities = {}
) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notification (user_id, type, title, description, project_id, task_id, rfq_id, attachment_id)
     SELECT DISTINCT m."userId", $3, $4, $5, $1::uuid, $6::uuid, $7::uuid, $8::uuid
     FROM project p
     JOIN member m ON m."organizationId" = p.org_id
     WHERE p.id = $1::uuid AND m."userId" != $2 AND m.role != 'client'`,
    [
      projectId,
      excludeUserId,
      type,
      title,
      description || "",
      ...entityValues(entities),
    ]
  );
}

/**
 * Look up a user's email by ID and send them a notification email.
 * Fire-and-forget: errors are logged, never thrown.
 */
export function notifyUserByEmail(
  userId: string,
  subject: string,
  html: string
) {
  const pool = getPool();
  pool
    .query(`SELECT email FROM "user" WHERE id = $1`, [userId])
    .then(({ rows }) => {
      const email = rows[0]?.email;
      if (!email) {
        logger.warn("notifyUserByEmail: no email found", { userId });
        return;
      }
      sendNotificationEmail(email, subject, html).catch((err) =>
        logger.error("notifyUserByEmail: failed to send email", {
          userId,
          error: err,
        })
      );
    })
    .catch((err) =>
      logger.error("notifyUserByEmail: query failed", { userId, error: err })
    );
}

/**
 * Look up a user's email + name (and optionally project name) by ID,
 * then call a builder to produce the email subject + body and send it.
 * Fire-and-forget: errors are logged, never thrown.
 */
export function notifyUserByEmailWithContext(
  userId: string,
  projectId: string | null,
  builder: (context: {
    email: string;
    name: string;
    projectName: string | null;
  }) => { subject: string; html: string }
) {
  const pool = getPool();
  const query = projectId
    ? `SELECT u.email, u.name, p.name AS project_name
       FROM "user" u
       LEFT JOIN project p ON p.id = $2
       WHERE u.id = $1`
    : `SELECT u.email, u.name FROM "user" u WHERE u.id = $1`;
  const params = projectId ? [userId, projectId] : [userId];

  pool
    .query(query, params)
    .then(({ rows }) => {
      const r = rows[0];
      if (!r?.email) {
        logger.warn("notifyUserByEmailWithContext: no email found", {
          userId,
          projectId,
        });
        return;
      }
      const { subject, html } = builder({
        email: r.email,
        name: r.name,
        projectName: r.project_name ?? null,
      });
      sendNotificationEmail(r.email, subject, html).catch((err) =>
        logger.error("notifyUserByEmailWithContext: failed to send email", {
          userId,
          error: err,
        })
      );
    })
    .catch((err) =>
      logger.error("notifyUserByEmailWithContext: query failed", {
        userId,
        error: err,
      })
    );
}

/**
 * Send notification emails to all org team members on a project,
 * excluding specified user IDs. Fire-and-forget.
 */
export function notifyTeamByEmail(
  projectId: string,
  excludeUserIds: string[],
  builder: (member: { email: string; name: string; projectName: string }) => {
    subject: string;
    html: string;
  }
) {
  const pool = getPool();
  const placeholders = excludeUserIds.map((_, i) => `$${i + 2}`).join(", ");
  const excludeClause = excludeUserIds.length
    ? `AND m."userId" NOT IN (${placeholders})`
    : "";

  pool
    .query(
      `SELECT DISTINCT u.email, u.name, p.name AS project_name
       FROM project p
       JOIN member m ON m."organizationId" = p.org_id
       JOIN "user" u ON u.id = m."userId"
       WHERE p.id = $1 AND m.role != 'client' ${excludeClause}`,
      [projectId, ...excludeUserIds]
    )
    .then(({ rows: members }) => {
      for (const member of members) {
        const { subject, html } = builder({
          email: member.email,
          name: member.name,
          projectName: member.project_name,
        });
        sendNotificationEmail(member.email, subject, html).catch((err) =>
          logger.error("notifyTeamByEmail: failed to send email", {
            projectId,
            email: member.email,
            error: err,
          })
        );
      }
    })
    .catch((err) =>
      logger.error("notifyTeamByEmail: query failed", { projectId, error: err })
    );
}

/**
 * Notify newly-assigned PMs that they were added to a project. Sends both an
 * in-app notification and an email per user. Fire-and-forget — errors are
 * logged, never thrown, so a notification hiccup never aborts the underlying
 * project create/update.
 *
 * Pass only the *newly* added user IDs — pre-existing PMs shouldn't be
 * re-notified on every PM list edit.
 */
export function notifyPmAssignment(
  projectId: string,
  newPmUserIds: string[],
  projectName: string,
  projectUrl: string,
  excludeUserId?: string
) {
  const recipients = newPmUserIds.filter((id) => id !== excludeUserId);
  if (recipients.length === 0) return;

  const pool = getPool();
  pool
    .query(`SELECT id, email FROM "user" WHERE id = ANY($1)`, [recipients])
    .then(async ({ rows }) => {
      const title = `${projectName} | Assigned as Project Manager`;
      const description = `You've been assigned as a PM on ${projectName}.`;
      const html = `<p>You've been assigned as Project Manager on <strong>${projectName}</strong>.</p>
        <p><a href="${projectUrl}">Open the project</a> to start managing.</p>`;

      await Promise.allSettled(
        rows.flatMap((u: { id: string; email: string }) => [
          createNotification({
            userId: u.id,
            type: "project_pm_assigned",
            title,
            description,
            projectId,
          }).catch((err) =>
            logger.error("notifyPmAssignment: in-app notif failed", {
              userId: u.id,
              error: err,
            })
          ),
          sendNotificationEmail(u.email, title, html).catch((err) =>
            logger.error("notifyPmAssignment: email failed", {
              userId: u.id,
              error: err,
            })
          ),
        ])
      );
    })
    .catch((err) =>
      logger.error("notifyPmAssignment: lookup failed", {
        projectId,
        error: err,
      })
    );
}

/**
 * Create a notification for the project client. Resolves the client user and
 * inserts in one round-trip; a project with no matching client user inserts
 * nothing.
 */
export async function createNotificationForClient(
  projectId: string,
  type: string,
  title: string,
  description?: string,
  entities: NotificationEntities = {}
) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notification (user_id, type, title, description, project_id, task_id, rfq_id, attachment_id)
     SELECT u.id, $2, $3, $4, $1::uuid, $5::uuid, $6::uuid, $7::uuid
     FROM "user" u
     JOIN project p ON p.client_email = u.email
     WHERE p.id = $1::uuid`,
    [projectId, type, title, description || "", ...entityValues(entities)]
  );
}
