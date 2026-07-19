/**
 * Every translation key the code asks for must exist in BOTH locales.
 *
 * next-intl renders a missing key as the key itself — no throw, no test
 * failure, nothing red anywhere. `serviceAreaRequiredLine` shipped to
 * production that way: the BOQ drawer printed the literal string
 * "rateContracts.serviceAreaRequiredLine" at users until someone noticed.
 *
 * This walks the source, resolves each `useTranslations`/`getTranslations`
 * binding to its namespace, and checks every literal key it's called with
 * against messages/en.json and messages/tr.json.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

type Messages = { [k: string]: string | Messages };

function loadLocale(locale: string): Messages {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8")
  );
}

const en = loadLocale("en");
const tr = loadLocale("tr");

/** Resolve a dotted path ("boq.table.colUnit") to a leaf string. */
function lookup(messages: Messages, dotted: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Every leaf key, dotted — for locale parity. */
function leafKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([k, v]) => {
    const dotted = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [dotted] : leafKeys(v, dotted);
  });
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // The test tree mocks next-intl; its `t()` calls aren't real keys.
      return entry.name === "test" ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

interface Usage {
  file: string;
  key: string;
}

/**
 * `const t = useTranslations("elements")` → t resolves keys under "elements".
 * A file may bind several (`t`, `tCommon`, `tRc`), so we key by variable name.
 */
const BINDING =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;

/** A dynamic namespace — `useTranslations(someVar)` — can't be resolved statically. */
const DYNAMIC_BINDING =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*[^"'\s)]/g;

const usages: Usage[] = [];
const dynamicKeys: Usage[] = [];

for (const file of sourceFiles(SRC)) {
  const code = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  const namespaces = new Map<string, string>();
  for (const [, varName, ns] of code.matchAll(BINDING)) {
    namespaces.set(varName, ns);
  }
  const dynamic = new Set(
    [...code.matchAll(DYNAMIC_BINDING)].map(([, varName]) => varName)
  );
  if (namespaces.size === 0) continue;

  for (const [varName, ns] of namespaces) {
    if (dynamic.has(varName)) continue;

    // `t("key")` / `t("key", { count })` / `t.rich("key", …)`
    const call = new RegExp(
      `\\b${varName}(?:\\.rich|\\.markup)?\\(\\s*"([^"]+)"`,
      "g"
    );
    for (const [, key] of code.matchAll(call)) {
      usages.push({ file: rel, key: `${ns}.${key}` });
    }

    // `t(\`status.${x}\`)` — the suffix is only known at runtime. Recorded so
    // the count is visible rather than silently unchecked.
    const templated = new RegExp(`\\b${varName}(?:\\.rich)?\\(\\s*\``, "g");
    for (const _ of code.matchAll(templated)) {
      dynamicKeys.push({ file: rel, key: `${ns}.<dynamic>` });
    }
  }
}

describe("i18n keys", () => {
  it("finds translation usages to check (guards against the scanner silently matching nothing)", () => {
    expect(usages.length).toBeGreaterThan(200);
  });

  it("every key used in the code exists in en.json", () => {
    const missing = usages
      .filter((u) => lookup(en, u.key) === undefined)
      .map((u) => `${u.key}  (${u.file})`);

    expect(missing).toEqual([]);
  });

  it("every key used in the code exists in tr.json", () => {
    const missing = usages
      .filter((u) => lookup(tr, u.key) === undefined)
      .map((u) => `${u.key}  (${u.file})`);

    expect(missing).toEqual([]);
  });

  // Parity in both directions: a key added to one locale and not the other is
  // the same bug caught one step earlier.
  it("en.json and tr.json define the same keys", () => {
    const enKeys = new Set(leafKeys(en));
    const trKeys = new Set(leafKeys(tr));

    expect({
      missingFromTr: [...enKeys].filter((k) => !trKeys.has(k)).sort(),
      missingFromEn: [...trKeys].filter((k) => !enKeys.has(k)).sort(),
    }).toEqual({ missingFromTr: [], missingFromEn: [] });
  });

  /**
   * Template-literal keys (`t(\`status.${s}\`)`) can't be resolved without
   * knowing the runtime value, so they are NOT covered above. Asserting the
   * count keeps that gap visible: if it grows, someone is adding uncheckable
   * keys, and the honest response is a lookup table rather than interpolation.
   */
  it("reports how many keys are built dynamically and therefore unchecked", () => {
    expect(dynamicKeys.length).toBeLessThanOrEqual(41);
  });
});
