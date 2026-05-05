"use client";

import { useVendorBankDetails } from "@/hooks/useVendors";
import { BankDetailsForm } from "@/components/vendors/BankDetailsForm";

interface Props {
  vendorId: string;
  enabled: boolean;
}

/**
 * PM-only bank-details panel. Lazy-loads encrypted details once `enabled`
 * flips to true (gates the audited GET behind explicit user intent). Wraps
 * the shared {@link BankDetailsForm} with the PM data layer.
 */
export function VendorBankDetailsForm({ vendorId, enabled }: Props) {
  const { bankDetails, isLoading, error, save } = useVendorBankDetails(
    vendorId,
    enabled
  );

  if (!enabled) return null;

  return (
    <BankDetailsForm
      value={bankDetails}
      isLoading={isLoading}
      error={error}
      onSave={save}
    />
  );
}
