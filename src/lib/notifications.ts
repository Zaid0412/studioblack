import { getPool } from "@/lib/db";

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
