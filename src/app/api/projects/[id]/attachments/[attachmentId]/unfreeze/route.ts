import { createFreezeHandler } from "../_shared/freezeHandler";

/** PATCH /api/projects/[id]/attachments/[attachmentId]/unfreeze — PM can unfreeze. */
export const PATCH = createFreezeHandler(false);
