import { getPool } from "@/lib/db";
import { generateBetterAuthId } from "./helpers";

/** Get a user's email and name by ID. */
export async function getUserEmailAndName(userId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT u.email, u.name FROM "user" u WHERE u.id = $1`, [
    userId,
  ]);
  return row || null;
}

/** Get users by IDs (id, email, name). */
export async function getUsersByIds(userIds: string[]) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, name FROM "user" WHERE id = ANY($1::text[])`,
    [userIds]
  );
  return rows;
}

/** Check if a user exists by email. Returns { id } or null. */
export async function checkUserExistsByEmail(email: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM "user" WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

/** Check if a user exists by email. */
export async function getUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
  return row || null;
}

/** Create a client user. Uses ON CONFLICT to handle concurrent creation races. */
export async function createClientUser(name: string, email: string) {
  const pool = getPool();
  const id = generateBetterAuthId();
  await pool.query(
    `INSERT INTO "user" (id, name, email, role, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'client', false, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [id, name, email]
  );
}
