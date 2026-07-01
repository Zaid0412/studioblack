import type { RfqResponseSource } from "@/lib/validations";

const LABELS: Record<RfqResponseSource, string> = {
  portal: "Portal",
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Phone",
  pdf: "PDF",
  excel: "Excel",
  manual: "Manual",
};

/**
 * Small chip showing how a quote arrived. Hidden for `portal` (the default,
 * vendor self-service) so only PM-recorded off-channel quotes are flagged.
 */
export function ResponseSourceBadge({ source }: { source: RfqResponseSource }) {
  if (source === "portal") return null;
  return (
    <span className="inline-flex items-center rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
      via {LABELS[source]}
    </span>
  );
}
