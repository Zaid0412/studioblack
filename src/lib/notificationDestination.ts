import { DEFAULT_BOQ_SEGMENT } from "@/app/(dashboard)/projects/[id]/boq/_lib/tabs";

/**
 * Pick the deep-link target for a notification. BOQ-related notifications
 * route into the BOQ sub-tab (whatever `DEFAULT_BOQ_SEGMENT` resolves to);
 * everything else lands on the project root.
 *
 * The producer (`_phaseNotifications.ts`) and the consumer (this) only
 * agree by the `boq_` type prefix — if the prefix ever changes there,
 * change it here too.
 */
export function notificationDestination(
  type: string,
  projectId: string
): string {
  if (type.startsWith("boq_")) {
    return `/projects/${projectId}/boq/${DEFAULT_BOQ_SEGMENT}`;
  }
  return `/projects/${projectId}`;
}
