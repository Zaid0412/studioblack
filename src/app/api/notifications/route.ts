import { NextResponse } from "next/server";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationsReadByIds,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, patchNotificationsSchema } from "@/lib/validations";

/**
 * GET /api/notifications — list notifications for the current user.
 *
 * `?unread=true` is the notification bell, which shows only what still needs
 * attention. Without it you get the full history, which is what /audit wants.
 * The two are separate SWR keys on purpose: the bell optimistically drops rows
 * from its cache as you read them, and that must not reach into the audit log.
 */
export const GET = withAuth({}, async (req, { user }) => {
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
  const rows = await getNotifications(user.id, { unreadOnly });
  return NextResponse.json(rows);
});

/** PATCH /api/notifications — mark notifications as read. */
export const PATCH = withAuth({}, async (req, { user }) => {
  const parsed = await parseRequest(req, patchNotificationsSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  if (body.markAllRead) {
    await markAllNotificationsRead(user.id);
  } else if (body.ids?.length) {
    await markNotificationsReadByIds(user.id, body.ids);
  }

  return NextResponse.json({ success: true });
});
