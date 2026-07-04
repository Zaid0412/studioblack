import {
  Ban,
  CalendarX,
  CircleCheck,
  CircleDot,
  Eye,
  Forklift,
  Handshake,
  HardHat,
  Layers,
  Lock,
  Package,
  PauseCircle,
  PencilLine,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  RateContractPriceBasis,
  RateContractStatus,
  RateContractType,
} from "@/lib/validations";

/** Status icons for rate-contract select options (labels are i18n). */
export const RATE_CONTRACT_STATUS_ICONS: Record<
  RateContractStatus,
  LucideIcon
> = {
  draft: PencilLine,
  under_review: Eye,
  approved: CircleCheck,
  active: CircleDot,
  suspended: PauseCircle,
  expired: CalendarX,
  closed: Lock,
  cancelled: Ban,
};

/** Contract-type icons for rate-contract select options (labels are i18n). */
export const RATE_CONTRACT_TYPE_ICONS: Record<RateContractType, LucideIcon> = {
  material: Package,
  labor: HardHat,
  equipment: Forklift,
  subcontract: Handshake,
  mixed: Layers,
};

/** Price-basis icons for rate-contract select options (labels are i18n). */
export const RATE_CONTRACT_PRICE_BASIS_ICONS: Record<
  RateContractPriceBasis,
  LucideIcon
> = {
  supply: Package,
  supply_install: Wrench,
};
