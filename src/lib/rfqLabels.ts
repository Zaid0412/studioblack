import {
  Award,
  Ban,
  Eye,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Globe,
  HardHat,
  Inbox,
  Layers,
  Mail,
  MessageCircle,
  Package,
  PencilLine,
  PenLine,
  Phone,
  Send,
  type LucideIcon,
} from "lucide-react";
import type {
  RfqPackageType,
  RfqResponseSource,
  RfqStatus,
} from "@/lib/validations";

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

/** Package-type icons for RFQ select options (labels are i18n). */
export const RFQ_PACKAGE_TYPE_ICONS: Record<RfqPackageType, LucideIcon> = {
  material: Package,
  labor: HardHat,
  mixed: Layers,
};

/** Status icons for RFQ select options (labels are i18n, colours via badge). */
export const RFQ_STATUS_ICONS: Record<RfqStatus, LucideIcon> = {
  draft: PencilLine,
  issued: Send,
  quotes_received: Inbox,
  under_review: Eye,
  awarded: Award,
  cancelled: Ban,
  superseded: GitBranch,
};
