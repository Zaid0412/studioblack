import { describe, it, expect } from "vitest";
import { sanitizeRfqEventsForVendor } from "@/lib/queries/rfqs";
import type { RfqEvent } from "@/types";

const VENDOR = "vendor-1";
const OTHER = "vendor-2";

const ev = (over: Partial<RfqEvent>): RfqEvent => ({
  id: "e",
  action: "rfq.issued",
  createdAt: "2026-01-01T00:00:00Z",
  actorId: "u-studio",
  actorName: "Zaid STB",
  metadata: null,
  ...over,
});

describe("sanitizeRfqEventsForVendor", () => {
  it("preserves the studio actor NAME but nulls the internal actor id", () => {
    // The regression guard: the vendor timeline must show "Zaid STB issued…",
    // not "Someone", while still hiding the internal user id.
    const [out] = sanitizeRfqEventsForVendor([ev({})], VENDOR);
    expect(out.actorName).toBe("Zaid STB");
    expect(out.actorId).toBeNull();
  });

  it("drops studio-only events (logged communications)", () => {
    const out = sanitizeRfqEventsForVendor(
      [
        ev({ action: "rfq.communication_logged" }),
        ev({ action: "rfq.issued" }),
      ],
      VENDOR
    );
    expect(out.map((e) => e.action)).toEqual(["rfq.issued"]);
  });

  it("keeps only THIS vendor's own quote.* events", () => {
    const out = sanitizeRfqEventsForVendor(
      [
        ev({ action: "quote.submitted", metadata: { vendor_id: VENDOR } }),
        ev({ action: "quote.submitted", metadata: { vendor_id: OTHER } }),
        ev({ action: "quote.awarded", metadata: { vendor_id: OTHER } }),
      ],
      VENDOR
    );
    expect(out).toHaveLength(1);
    expect((out[0].metadata as { vendor_id: string }).vendor_id).toBe(VENDOR);
  });

  it("strips competitor vendor identities from metadata", () => {
    const [out] = sanitizeRfqEventsForVendor(
      [
        ev({
          metadata: {
            vendor_names: ["Acme", "Beta"],
            vendor_ids: ["x", "y"],
            winning_vendor_names: ["Acme"],
            item_count: 3,
          },
        }),
      ],
      VENDOR
    );
    expect(out.metadata).toEqual({ item_count: 3 });
  });
});
