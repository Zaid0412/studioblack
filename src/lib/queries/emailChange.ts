import { getPool } from "@/lib/db";

/** Create a pending email change record and return the verification token. */
export async function createPendingEmailChange(
  userId: string,
  newEmail: string
): Promise<{ token: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Delete any existing pending changes for this user + expired rows for any user
    await client.query(
      `DELETE FROM pending_email_change WHERE user_id = $1 OR expires_at < NOW()`,
      [userId]
    );
    const { rows } = await client.query(
      `INSERT INTO pending_email_change (user_id, new_email) VALUES ($1, $2) RETURNING token`,
      [userId, newEmail]
    );
    await client.query("COMMIT");
    return { token: rows[0].token };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface PendingEmailChange {
  user_id: string;
  new_email: string;
  old_email: string;
  expires_at: string;
  failed_attempts: number;
}

/** Retrieve a pending email change by token. */
export async function getPendingEmailChange(
  token: string
): Promise<PendingEmailChange | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.user_id, p.new_email, p.expires_at, p.failed_attempts, u.email AS old_email
     FROM pending_email_change p
     JOIN "user" u ON u.id = p.user_id
     WHERE p.token = $1`,
    [token]
  );
  return rows[0] || null;
}

/** Increment and return the failed attempts count for a pending email change. */
export async function incrementFailedAttempts(token: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE pending_email_change SET failed_attempts = failed_attempts + 1 WHERE token = $1 RETURNING failed_attempts`,
    [token]
  );
  return rows[0]?.failed_attempts ?? 0;
}

/** Delete a pending email change by token. */
export async function deletePendingEmailChange(token: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM pending_email_change WHERE token = $1`, [
    token,
  ]);
}

/** Check whether an email address is already in use. */
export async function isEmailTaken(email: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

/**
 * Update user email and invalidate sessions. Throws `EmailTakenError` if
 * the unique index on LOWER(email) is violated (race-condition safe).
 */
export class EmailTakenError extends Error {
  constructor() {
    super("This email is already in use");
    this.name = "EmailTakenError";
  }
}

/** Update user email, mark as verified, and invalidate all sessions. */
export async function updateUserEmail(userId: string, newEmail: string) {
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE "user" SET email = $1, "emailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
      [newEmail, userId]
    );
  } catch (err: unknown) {
    // Unique constraint violation on email (23505 = unique_violation)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      throw new EmailTakenError();
    }
    throw err;
  }
  // Invalidate all sessions so the user re-authenticates with the new email
  await pool.query(`DELETE FROM session WHERE "userId" = $1`, [userId]);
}

/** Get the password hash for a user's credential account. */
export async function getAccountPasswordHash(
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT password FROM account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [userId]
  );
  return rows[0]?.password || null;
}
