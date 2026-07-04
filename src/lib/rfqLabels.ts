import {
  FileSpreadsheet,
  FileText,
  Globe,
  Mail,
  MessageCircle,
  PenLine,
  Phone,
  type LucideIcon,
} from "lucide-react";
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

/** Channel icons, paired with RESPONSE_SOURCE_LABELS for select options. */
export const RESPONSE_SOURCE_ICONS: Record<RfqResponseSource, LucideIcon> = {
  portal: Globe,
  email: Mail,
  whatsapp: MessageCircle,
  phone: Phone,
  pdf: FileText,
  excel: FileSpreadsheet,
  manual: PenLine,
};
