import { getPool } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  description?: string;
  projectId?: string;
  taskId?: string;
}

/** Create a single notification record. */
export async function createNotification(input: CreateNotificationInput) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notification (user_id, type, title, description, project_id, task_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.userId,
      input.type,
      input.title,
      input.description || "",
      input.projectId || null,
      input.taskId || null,
    ]
  );
}

/** Create notifications for all team members on a project (excluding a specific user). */
export async function createNotificationsForTeam(
  projectId: string,
  excludeUserId: string,
  type: string,
  title: string,
  description?: string
) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO notification (user_id, type, title, description, project_id)
     SELECT DISTINCT m."userId", $3, $4, $5, $1::uuid
     FROM project p
     JOIN member m ON m."organizationId" = p.org_id
     WHERE p.id = $1::uuid AND m."userId" != $2`,
    [projectId, excludeUserId, type, title, description || ""]
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
        logger.error("notifyUserByEmail: failed to send email", { userId, error: err })
      );
    })
    .catch((err) => logger.error("notifyUserByEmail: query failed", { userId, error: err }));
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
        logger.warn("notifyUserByEmailWithContext: no email found", { userId, projectId });
        return;
      }
      const { subject, html } = builder({
        email: r.email,
        name: r.name,
        projectName: r.project_name ?? null,
      });
      sendNotificationEmail(r.email, subject, html).catch((err) =>
        logger.error("notifyUserByEmailWithContext: failed to send email", { userId, error: err })
      );
    })
    .catch((err) => logger.error("notifyUserByEmailWithContext: query failed", { userId, error: err }));
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
  const placeholders = excludeUserIds
    .map((_, i) => `$${i + 2}`)
    .join(", ");
  const excludeClause = excludeUserIds.length
    ? `AND m."userId" NOT IN (${placeholders})`
    : "";

  pool
    .query(
      `SELECT DISTINCT u.email, u.name, p.name AS project_name
       FROM project p
       JOIN member m ON m."organizationId" = p.org_id
       JOIN "user" u ON u.id = m."userId"
       WHERE p.id = $1 ${excludeClause}`,
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
          logger.error("notifyTeamByEmail: failed to send email", { projectId, email: member.email, error: err })
        );
      }
    })
    .catch((err) => logger.error("notifyTeamByEmail: query failed", { projectId, error: err }));
}

/** Create a notification for the project client. */
export async function createNotificationForClient(
  projectId: string,
  type: string,
  title: string,
  description?: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id FROM "user" u
     JOIN project p ON p.client_email = u.email
     WHERE p.id = $1`,
    [projectId]
  );
  if (rows[0]) {
    await createNotification({
      userId: rows[0].id,
      type,
      title,
      description,
      projectId,
    });
  }
}
