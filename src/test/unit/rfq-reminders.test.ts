import { describe, it, expect, beforeEach, vi } from "vitest";
import { mocks } from "../setup";
import { sendRfqReminderEmail } from "@/lib/email";

/**
 * `runRfqReminders` drives the real query layer (`getDueRfqReminders` +
 * `markRfqVendorsReminded`, imported by file path so the `@/lib/queries` barrel
 * mock doesn't intercept them) against a shape-routed pooled client, plus the
 * mocked reminder email. It should email one row per due contact, then stamp one
 * reminder per (rfq, vendor) — deduped across a vendor's multiple contacts, and
 * even when a send fails.
 */
async function realRunRfqReminders() {
  const actual =
    await vi.importActual<typeof import("@/lib/rfqReminders")>(
      "@/lib/rfqReminders"
    );
  return actual.runRfqReminders();
}

const RFQ = "rfq-1";
const VENDOR_A = "vendor-a";
const VENDOR_B = "vendor-b";

/** Two contacts for vendor A, one for vendor B — three emailable rows. */
const DUE_ROWS = [
  row(VENDOR_A, "a1@x.com"),
  row(VENDOR_A, "a2@x.com"),
  row(VENDOR_B, "b1@x.com"),
];

function row(vendorId: string, email: string) {
  return {
    rfq_id: RFQ,
    rfq_number: "P2026-001-RFQ-001",
    rfq_title: "Tiling package",
    project_name: "Casa Belluno",
    response_deadline: "2026-08-01",
    vendor_id: vendorId,
    reminder_count: 0,
    vendor_name: "Vendor",
    contact_name: "Contact",
    contact_email: email,
  };
}

/** Route the SELECT (due rows) and the UPDATE (mark) by SQL shape. */
function wire(dueRows: ReturnType<typeof row>[]) {
  mocks.db.query.mockImplementation((sql: string) => {
    if (/UPDATE rfq_vendor/.test(sql)) return Promise.resolve({ rowCount: 0 });
    if (/FROM rfq_vendor rv/.test(sql))
      return Promise.resolve({ rows: dueRows });
    return Promise.resolve({ rows: [] });
  });
}

const markCalls = () =>
  mocks.db.query.mock.calls.filter((c) =>
    /UPDATE rfq_vendor/.test(String(c[0]))
  );
/** Vendor id stamped by each mark UPDATE, in call order. */
const markedVendors = () =>
  markCalls().map((c) => (c[1] as [string[], string[]])[1][0]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runRfqReminders", () => {
  it("emails every due contact and stamps one reminder per (rfq, vendor)", async () => {
    wire(DUE_ROWS);
    const res = await realRunRfqReminders();

    // One email per emailable contact.
    expect(sendRfqReminderEmail).toHaveBeenCalledTimes(3);
    expect(vi.mocked(sendRfqReminderEmail).mock.calls[0][0]).toBe("a1@x.com");

    // Stamped once per vendor, right after its email(s) — vendor A's two
    // contacts share a single stamp — and each stamp targets the one RFQ.
    expect(markCalls()).toHaveLength(2);
    expect(markedVendors()).toEqual([VENDOR_A, VENDOR_B]);
    expect((markCalls()[0][1] as [string[], string[]])[0]).toEqual([RFQ]);

    expect(res).toEqual({ rfqs: 1, vendors: 2, emails: 3 });
  });

  it("builds the per-RFQ deep link and next reminder number", async () => {
    wire([row(VENDOR_B, "b1@x.com")]);
    await realRunRfqReminders();

    const args = vi.mocked(sendRfqReminderEmail).mock.calls[0][1];
    expect(args.deepLink).toBe("http://localhost:3000/rfqs/rfq-1");
    expect(args.reminderNumber).toBe(1); // reminder_count 0 → 1st reminder
    expect(args.responseDeadline).toBe("2026-08-01");
  });

  it("still stamps a vendor whose email send failed (no daily retry)", async () => {
    wire([row(VENDOR_A, "a1@x.com")]);
    vi.mocked(sendRfqReminderEmail).mockRejectedValueOnce(new Error("smtp"));

    const res = await realRunRfqReminders();

    expect(res.emails).toBe(0); // the send failed
    expect(markCalls()).toHaveLength(1); // but it was still stamped
    expect(res.vendors).toBe(1);
  });

  it("does nothing (and never stamps) when no vendor is due", async () => {
    wire([]);
    const res = await realRunRfqReminders();

    expect(sendRfqReminderEmail).not.toHaveBeenCalled();
    expect(markCalls()).toHaveLength(0);
    expect(res).toEqual({ rfqs: 0, vendors: 0, emails: 0 });
  });
});

describe("getDueRfqReminders — SQL contract", () => {
  it("only selects open, unanswered, 3-day-overdue invites", async () => {
    const rfqs =
      await vi.importActual<typeof import("@/lib/queries/rfqs")>(
        "@/lib/queries/rfqs"
      );
    mocks.db.query.mockResolvedValueOnce({ rows: [] });
    await rfqs.getDueRfqReminders();

    const sql = String(mocks.db.query.mock.calls[0][0]);
    expect(sql).toContain(
      "status IN ('issued', 'quotes_received', 'under_review')"
    );
    expect(sql).toContain(
      "COALESCE(rv.last_reminder_at, rv.invited_at) <= now() - interval '3 days'"
    );
    expect(sql).toMatch(/NOT EXISTS[\s\S]*vendor_quote[\s\S]*is_current/);
    expect(sql).toContain("vc.receives_rfq = true");
    expect(sql).toContain("v.status = 'active'");
  });
});
