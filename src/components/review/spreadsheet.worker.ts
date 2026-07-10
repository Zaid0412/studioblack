/// <reference lib="webworker" />
import { parseWorkbookToSheets } from "./spreadsheet-parse";
import type { SpreadsheetWorkerResult } from "./spreadsheet-types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Parse an Excel workbook off the main thread so a large file doesn't freeze
 * the tab during parse. Receives the fetched `ArrayBuffer`, posts back the
 * normalized sheet array (or an error). The transform lives in
 * `spreadsheet-parse.ts` so it's shared with the unit test.
 */
ctx.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const sheets = await parseWorkbookToSheets(e.data);
    ctx.postMessage({ ok: true, sheets } satisfies SpreadsheetWorkerResult);
  } catch (err) {
    ctx.postMessage({
      ok: false,
      error: String(err),
    } satisfies SpreadsheetWorkerResult);
  }
};
