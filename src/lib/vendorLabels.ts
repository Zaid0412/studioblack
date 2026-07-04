import {
  Ban,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleOff,
  CircleX,
  Clock,
  Heart,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import type {
  VendorKycStatus,
  VendorProficiency,
  VendorStatus,
} from "@/lib/validations";

/** Status icons for vendor select options (labels are i18n). */
export const VENDOR_STATUS_ICONS: Record<VendorStatus, LucideIcon> = {
  active: CircleCheck,
  inactive: CircleOff,
  blacklisted: Ban,
  pending_approval: Clock,
};

/** Proficiency icons for vendor trade select options (labels are i18n). */
export const VENDOR_PROFICIENCY_ICONS: Record<VendorProficiency, LucideIcon> = {
  standard: Circle,
  specialist: Star,
  preferred: Heart,
};

/** KYC-status icons for vendor select options (labels are i18n). */
export const VENDOR_KYC_STATUS_ICONS: Record<VendorKycStatus, LucideIcon> = {
  unverified: CircleDashed,
  pending: Clock,
  verified: ShieldCheck,
  rejected: CircleX,
};
