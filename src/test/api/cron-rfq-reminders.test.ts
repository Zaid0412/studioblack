import { describe, it, expect, beforeEach, vi } from "vitest";
import { env } from "@/env";

/**
 * The RFQ-reminder cron route is a machine endpoint, not a `withAuth` route: it
 * gates solely on the `Authorization: Bearer <CRON_SECRET>` header and refuses to
 * run when CRON_SECRET is unset. The actual run is stubbed here.
 */
vi.mock("@/lib/rfqReminders", () => ({
  runRfqReminders: vi
    .fn()
    .mockResolvedValue({ rfqs: 2, vendors: 3, emails: 3 }),
}));

import { GET } from "@/app/api/cron/rfq-reminders/route";
import { runRfqReminders } from "@/lib/rfqReminders";

const BASE_ENV = env();
const SECRET = "test-cron-secret";

/** Point env().CRON_SECRET at `secret` (undefined = "not configured"). */
function setSecret(secret: string | undefined) {
  vi.mocked(env).mockReturnValue({ ...BASE_ENV, CRON_SECRET: secret });
}

const call = (auth?: string) =>
  GET(
    new Request(
      "http://localhost/api/cron/rfq-reminders",
      auth ? { headers: { authorization: auth } } : undefined
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  setSecret(SECRET);
});

describe("GET /api/cron/rfq-reminders", () => {
  it("503s when CRON_SECRET isn't configured", async () => {
    setSecret(undefined);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(503);
    expect(runRfqReminders).not.toHaveBeenCalled();
  });

  it("401s without an Authorization header", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(runRfqReminders).not.toHaveBeenCalled();
  });

  it("401s with the wrong bearer token", async () => {
    const res = await call("Bearer nope");
    expect(res.status).toBe(401);
    expect(runRfqReminders).not.toHaveBeenCalled();
  });

  it("runs and returns the summary with the right secret", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      rfqs: 2,
      vendors: 3,
      emails: 3,
    });
    expect(runRfqReminders).toHaveBeenCalledTimes(1);
  });
});
