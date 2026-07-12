/**
 * Builds and upserts the "Tests passed/failed" comment on a PR.
 *
 * Lives here rather than inline in `test.yml` so it gets lint/prettier coverage
 * and — more usefully — so the markdown builders below stay pure functions that
 * can be unit-tested (see `src/test/unit/pr-test-comment.test.ts`). Previously
 * the only way to know the comment rendered correctly was to open a PR.
 *
 * Used from the workflow via actions/github-script:
 *   const { run } = require('./.github/scripts/pr-test-comment.js');
 *   await run({ github, context });
 */

const fs = require("fs");

const MARKER = "<!-- studioblack-test-results -->";
const HEADER = "| | File | Passed | Failed | Duration |";
const DIVIDER = "|---|------|--------|--------|----------|";
const RESULTS_FILE = "test-results.json";

/**
 * Reads the vitest JSON report. Returns null when it's missing or unparseable
 * (e.g. the test step crashed before writing it) so the caller can still post a
 * failure comment.
 */
function readResults(path = RESULTS_FILE) {
  try {
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** One markdown table row for a test file. */
function toRow(file) {
  const name = file.name.replace(/^.*src\/test\//, "");
  const total = file.assertionResults?.length ?? 0;
  const pass =
    file.assertionResults?.filter((t) => t.status === "passed").length ?? 0;
  const fail = total - pass;
  const duration = ((file.endTime - file.startTime) / 1000).toFixed(2);
  return `| ${fail > 0 ? "❌" : "✅"} | \`${name}\` | ${pass} | ${fail} | ${duration}s |`;
}

/** True when any test in the file did not pass. */
function hasFailures(file) {
  return (
    (file.assertionResults?.filter((t) => t.status !== "passed").length ?? 0) >
    0
  );
}

/**
 * Pulls the preview/inspect links out of the vercel[bot] comment, which encodes
 * them as a base64 blob. Returns '' when there's no deployment yet.
 */
function extractVercelSection(comments = []) {
  try {
    const vcComment = comments.find(
      (c) => c.user?.login === "vercel[bot]" && c.body?.includes("[vc]")
    );
    if (!vcComment) return "";

    const b64Match = vcComment.body.match(/\[vc\]:\s*#[^:]+:(\S+)/);
    if (!b64Match) return "";

    const data = JSON.parse(Buffer.from(b64Match[1], "base64").toString());
    const project = data.projects?.[0];
    if (!project) return "";

    return [
      "",
      "### Deployment",
      "",
      "| | |",
      "|---|---|",
      `| **Preview** | [${project.previewUrl}](https://${project.previewUrl}) |`,
      `| **Inspect** | [View on Vercel](${project.inspectorUrl}) |`,
      "",
    ].join("\n");
  } catch {
    return "";
  }
}

/**
 * Composes the comment markdown.
 *
 * The per-file table runs to ~160 rows, so it stays collapsed behind a
 * <details> and only a one-line summary is always visible. When something
 * fails, the failing files are surfaced inline (expanded) so breakage is
 * visible without clicking.
 */
function buildCommentBody(results, vercelSection = "") {
  const passed = Boolean(results?.success);
  const icon = passed ? "✅" : "❌";
  const status = passed ? "passed" : "failed";

  let summaryLine = "";
  let failedTable = "";
  let detailsBlock = "";

  if (results?.testResults?.length) {
    const files = results.testResults;
    const rows = files.map(toRow);
    const failedRows = files.filter(hasFailures).map(toRow);

    const passedTests = results.numPassedTests ?? 0;
    const failedTests = results.numFailedTests ?? 0;
    const fileCount = files.length;
    const totalDuration =
      files.reduce((sum, f) => sum + (f.endTime - f.startTime), 0) / 1000;

    summaryLine = `**${passedTests}** passed · **${failedTests}** failed · ${fileCount} files · ${totalDuration.toFixed(2)}s`;

    if (failedRows.length) {
      failedTable = [
        "",
        "### Failed files",
        "",
        HEADER,
        DIVIDER,
        ...failedRows,
      ].join("\n");
    }

    detailsBlock = [
      "",
      `<details><summary>Per-file results (${fileCount} files)</summary>`,
      "",
      HEADER,
      DIVIDER,
      ...rows,
      `| | **Total** | **${passedTests}** | **${failedTests}** | **${totalDuration.toFixed(2)}s** |`,
      "",
      "</details>",
    ].join("\n");
  }

  return [
    MARKER,
    `## ${icon} Tests ${status}`,
    "",
    summaryLine,
    vercelSection,
    failedTable,
    detailsBlock,
    "",
  ].join("\n");
}

/** Entry point called by actions/github-script. */
async function run({ github, context }) {
  const { data: allComments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  const body = buildCommentBody(
    readResults(),
    extractVercelSection(allComments)
  );

  const existing = allComments.find(
    (c) => c.user.type === "Bot" && c.body.includes(MARKER)
  );

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    });
  }
}

module.exports = {
  run,
  buildCommentBody,
  extractVercelSection,
  readResults,
  MARKER,
};
