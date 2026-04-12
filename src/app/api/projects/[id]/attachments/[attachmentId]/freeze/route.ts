import { createFreezeHandler } from "../_shared/freezeHandler";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/freeze — PM can freeze a file. */
export const PATCH = createFreezeHandler(true);
