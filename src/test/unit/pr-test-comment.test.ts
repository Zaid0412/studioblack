import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

// The script is CommonJS (actions/github-script `require()`s it), so load it the
// same way rather than through an ESM import.
const require = createRequire(import.meta.url);
const {
  buildCommentBody,
  extractVercelSection,
  MARKER,
} = require("../../../.github/scripts/pr-test-comment.js");

/** Minimal shape of a vitest JSON-report file entry. */
function file(
  name: string,
  {
    pass = 1,
    fail = 0,
    ms = 1000,
  }: { pass?: number; fail?: number; ms?: number } = {}
) {
  return {
    name: `/repo/src/test/${name}`,
    startTime: 0,
    endTime: ms,
    assertionResults: [
      ...Array.from({ length: pass }, () => ({ status: "passed" })),
      ...Array.from({ length: fail }, () => ({ status: "failed" })),
    ],
  };
}

function results(files: ReturnType<typeof file>[], success: boolean) {
  const numPassedTests = files.reduce(
    (n, f) =>
      n + f.assertionResults.filter((a) => a.status === "passed").length,
    0
  );
  const numFailedTests = files.reduce(
    (n, f) =>
      n + f.assertionResults.filter((a) => a.status !== "passed").length,
    0
  );
  return { success, testResults: files, numPassedTests, numFailedTests };
}

describe("buildCommentBody", () => {
  it("collapses the per-file table behind <details> when everything passes", () => {
    const body = buildCommentBody(
      results([file("api/a.test.ts"), file("unit/b.test.ts")], true)
    );

    expect(body).toContain(MARKER);
    expect(body).toContain("## ✅ Tests passed");
    // The long table must not be visible by default — that was the whole point.
    expect(body).toContain(
      "<details><summary>Per-file results (2 files)</summary>"
    );
    expect(body).toContain("</details>");
    // No failed-files section when nothing failed.
    expect(body).not.toContain("### Failed files");
  });

  it("surfaces failing files inline (outside the <details>) when a test fails", () => {
    const body = buildCommentBody(
      results(
        [
          file("api/ok.test.ts"),
          file("unit/bad.test.ts", { pass: 1, fail: 2 }),
        ],
        false
      )
    );

    expect(body).toContain("## ❌ Tests failed");
    expect(body).toContain("### Failed files");

    // The failing file must appear BEFORE the collapsed block, so it's visible
    // without expanding anything; the passing one must not be in that section.
    const failedIdx = body.indexOf("### Failed files");
    const detailsIdx = body.indexOf("<details>");
    expect(failedIdx).toBeGreaterThan(-1);
    expect(failedIdx).toBeLessThan(detailsIdx);

    const failedSection = body.slice(failedIdx, detailsIdx);
    expect(failedSection).toContain("unit/bad.test.ts");
    expect(failedSection).not.toContain("api/ok.test.ts");
  });

  it("reports totals in the summary line", () => {
    const body = buildCommentBody(
      results(
        [
          file("api/a.test.ts", { pass: 3, ms: 500 }),
          file("unit/b.test.ts", { pass: 2, fail: 1, ms: 1500 }),
        ],
        false
      )
    );
    expect(body).toContain("**5** passed · **1** failed · 2 files · 2.00s");
  });

  it("still renders a failure comment when the report is missing", () => {
    const body = buildCommentBody(null);
    expect(body).toContain("## ❌ Tests failed");
    expect(body).toContain(MARKER);
    expect(body).not.toContain("<details>");
  });

  it("strips the path prefix so rows show the test-relative name", () => {
    const body = buildCommentBody(results([file("api/vendors.test.ts")], true));
    expect(body).toContain("`api/vendors.test.ts`");
    expect(body).not.toContain("/repo/src/test/");
  });
});

describe("extractVercelSection", () => {
  it("decodes the preview + inspect links from the vercel bot comment", () => {
    const payload = Buffer.from(
      JSON.stringify({
        projects: [
          {
            previewUrl: "sb-abc.vercel.app",
            inspectorUrl: "https://vercel.com/i/1",
          },
        ],
      })
    ).toString("base64");

    const section = extractVercelSection([
      { user: { login: "vercel[bot]" }, body: `[vc]: #hash:${payload}` },
    ]);

    expect(section).toContain("### Deployment");
    expect(section).toContain("[sb-abc.vercel.app](https://sb-abc.vercel.app)");
    expect(section).toContain("https://vercel.com/i/1");
  });

  it("returns nothing when there's no vercel comment or it's malformed", () => {
    expect(extractVercelSection([])).toBe("");
    expect(
      extractVercelSection([{ user: { login: "someone" }, body: "hi" }])
    ).toBe("");
    expect(
      extractVercelSection([
        { user: { login: "vercel[bot]" }, body: "[vc]: #h:!!not-base64!!" },
      ])
    ).toBe("");
  });
});
