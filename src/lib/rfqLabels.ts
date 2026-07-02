import type { RfqResponseSource } from "@/lib/validations";

/** Display labels for how a quote reached us (portal = vendor self-service). */
export const RESPONSE_SOURCE_LABELS: Record<RfqResponseSource, string> = {
  portal: "Portal",
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Phone",
  pdf: "PDF",
  excel: "Excel",
  manual: "Manual",
};
