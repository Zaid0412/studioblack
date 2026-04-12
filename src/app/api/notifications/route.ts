import { NextResponse } from "next/server";
import {
  getUnreadNotificationCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationsReadByIds,
  deleteNotification,
  deleteAllNotifications,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  patchNotificationsSchema,
  deleteNotificationsSchema,
} from "@/lib/validations";

/** GET /api/notifications — list notifications for current user. */
export const GET = withAuth({}, async (req, { user }) => {
  const { searchParams } = req.nextUrl;

  if (searchParams.get("unread") === "true") {
    const count = await getUnreadNotificationCount(user.id);
    return NextResponse.json({ count });
  }

  const rows = await getNotifications(user.id);
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

/** DELETE /api/notifications — delete notifications. Pass { id } for single, omit for all. */
export const DELETE = withAuth({}, async (req, { user }) => {
  const parsed = await parseRequest(req, deleteNotificationsSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  if (body.id) {
    await deleteNotification(user.id, body.id);
  } else {
    await deleteAllNotifications(user.id);
  }

  return NextResponse.json({ success: true });
});
