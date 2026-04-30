import type { Vendor, VendorWithRelations } from "@/types";
import { TEST_ORG_ID, TEST_USER_ID } from "../helpers";

export const TEST_VENDOR_ID = "11111111-1111-4111-8111-111111111111";

/** Build a `Vendor` row for tests with sane defaults. Override any field via `overrides`. */
export function buildVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: TEST_VENDOR_ID,
    org_id: TEST_ORG_ID,
    company_name: "Acme Co",
    trading_name: null,
    vendor_code: "V001",
    status: "active",
    rating: 0,
    payment_terms: null,
    currency: "USD",
    vat_registered: false,
    vat_number: null,
    tax_id: null,
    kyc_status: "unverified",
    kyc_verified_at: null,
    kyc_verified_by: null,
    kyc_notes: null,
    address: null,
    notes: null,
    created_by: TEST_USER_ID,
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
    ...overrides,
  };
}

/** Build a `VendorWithRelations` row for tests with empty contacts/trades. */
export function buildVendorWithRelations(
  overrides: Partial<VendorWithRelations> = {}
): VendorWithRelations {
  return {
    ...buildVendor(),
    contacts: [],
    trades: [],
    ...overrides,
  };
}
