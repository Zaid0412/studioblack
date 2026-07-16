import fs from "fs";
import path from "path";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
} from "@react-pdf/renderer";
import { branding } from "@/config/branding";
import {
  formatQty,
  toNum,
} from "@/app/(dashboard)/projects/[id]/boq/_lib/formatters";
import type { BoqItemWithComputed } from "@/types";

/**
 * Client-only BOQ PDF attached to the "sent to client" email. Omits
 * internal cost / margin / overhead / budget — the client should see
 * exactly what the portal shows them, nothing more.
 *
 * Uses react-pdf-renderer (no Chromium dep, Vercel-friendly).
 */

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

// Hoisted to avoid re-instantiating per cell — 500-item BOQ × 7 numeric
// cells would otherwise build ~3.5k formatter instances per render.
const MONEY_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtMoney = (n: number) => MONEY_FORMAT.format(n);

const styles = StyleSheet.create({
  page: {
    padding: 32,
    paddingTop: 28,
    paddingBottom: 48,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    color: "#0d0d0d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#F5C518",
    paddingBottom: 8,
  },
  logo: { width: 80, height: "auto" },
  headerRight: { textAlign: "right" },
  titleSmall: { fontSize: 9, color: "#71717a" },
  titleLarge: { fontSize: 14, fontFamily: FONT_BOLD, marginTop: 2 },
  projectMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaBlock: { flexDirection: "column", maxWidth: "60%" },
  metaLabel: { fontSize: 7.5, color: "#71717a", textTransform: "uppercase" },
  metaValue: { fontSize: 10, fontFamily: FONT_BOLD, marginTop: 1 },
  commentBox: {
    backgroundColor: "#f4f4f5",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
    fontSize: 9,
    color: "#3f3f46",
  },
  sectionHeader: {
    flexDirection: "row",
    backgroundColor: "#0d0d0d",
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 8,
    fontFamily: FONT_BOLD,
    fontSize: 9,
  },
  divisionBand: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0d0d0d",
    paddingVertical: 3,
    paddingHorizontal: 2,
    marginTop: 12,
    fontFamily: FONT_BOLD,
    fontSize: 10,
    color: "#0d0d0d",
    textTransform: "uppercase",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e4e4e7",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: FONT_BOLD,
    fontSize: 8.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#a1a1aa",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4e7",
  },
  // Column widths sum to 100% for A4 landscape.
  colCode: { width: "10%" },
  colName: { width: "26%", paddingRight: 4 },
  colDesc: { width: "26%", paddingRight: 4, color: "#52525b" },
  colUnit: { width: "6%", textAlign: "center" },
  colQty: { width: "8%", textAlign: "right" },
  colRate: { width: "12%", textAlign: "right" },
  colTotal: { width: "12%", textAlign: "right", fontFamily: FONT_BOLD },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#0d0d0d",
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: FONT_BOLD,
    marginRight: 16,
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: FONT_BOLD,
    color: "#0d0d0d",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#71717a",
  },
});

type RenderItem = BoqItemWithComputed & { section_title: string | null };
type PricedItem = RenderItem & { _rate: number; _total: number };

export interface RenderBoqPdfInput {
  projectName: string;
  /** BOQ business reference — `P2026-001-BOQ-001`. Shown in the header. */
  boqNumber?: string | null;
  boqTitle: string;
  currency: string;
  comment?: string | null;
  /** ISO date string for the header. Defaults to today (UTC). */
  issuedAt?: string;
  items: ReadonlyArray<RenderItem>;
}

/**
 * Client-facing rate prefers the manual `client_rate` override; otherwise
 * derive a per-unit number from `sell_price / quantity` so the column
 * always shows something meaningful. Line total mirrors the rule.
 */
function priceItem(item: RenderItem): { rate: number; total: number } {
  const override = toNum(item.client_rate);
  const qty = toNum(item.quantity);
  if (override > 0) {
    return { rate: override, total: override * qty };
  }
  const sell = toNum(item.sell_price);
  const rate = qty === 0 ? 0 : sell / qty;
  return { rate, total: sell };
}

/**
 * Group items by section title, preserving input order. Items without
 * a section land under "Other items" so they still appear. Each group also
 * carries its division name (from the first item) so the renderer can band
 * sections under their division.
 */
function groupBySection(
  items: ReadonlyArray<PricedItem>
): Array<{ title: string; division: string | null; items: PricedItem[] }> {
  const groups: Array<{
    title: string;
    division: string | null;
    items: PricedItem[];
  }> = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const title = item.section_title ?? "Other items";
    let i = index.get(title);
    if (i === undefined) {
      i = groups.length;
      index.set(title, i);
      groups.push({ title, division: item.division_name ?? null, items: [] });
    }
    groups[i].items.push(item);
  }
  return groups;
}

// Read once at cold start — @react-pdf/renderer would otherwise re-read
// the file from disk on every renderToBuffer call.
const LOGO_BUFFER = fs.readFileSync(
  path.join(process.cwd(), "public", "logo.png")
);

function BoqPdfDocument({
  projectName,
  boqNumber,
  boqTitle,
  currency,
  comment,
  issuedAt,
  items,
}: RenderBoqPdfInput) {
  const priced: PricedItem[] = items.map((it) => {
    const { rate, total } = priceItem(it);
    return { ...it, _rate: rate, _total: total };
  });
  const grandTotal = priced.reduce((sum, it) => sum + it._total, 0);
  const groups = groupBySection(priced);
  const issuedDate = issuedAt ?? new Date().toISOString().slice(0, 10);

  return (
    <Document
      title={`BoQ — ${projectName}`}
      author={branding.appName}
      subject={`Bill of Quantities for ${projectName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_BUFFER} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.titleSmall}>
              BILL OF QUANTITIES{boqNumber ? ` · ${boqNumber}` : ""}
            </Text>
            <Text style={styles.titleLarge}>{boqTitle}</Text>
          </View>
        </View>

        <View style={styles.projectMeta}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{projectName}</Text>
          </View>
          <View style={[styles.metaBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>
              {issuedDate} · {currency}
            </Text>
          </View>
        </View>

        {comment ? (
          <View style={styles.commentBox}>
            <Text>{comment}</Text>
          </View>
        ) : null}

        {groups.map((group, gi) => {
          // Division band before the first section of each new division.
          const showBand =
            group.division !== null &&
            (gi === 0 || groups[gi - 1].division !== group.division);
          return (
            <View key={`g-${gi}`} wrap={false}>
              {showBand && (
                <View style={styles.divisionBand}>
                  <Text>{group.division}</Text>
                </View>
              )}
              <View style={styles.sectionHeader}>
                <Text>{group.title}</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={styles.colCode}>Line</Text>
                <Text style={styles.colName}>Item</Text>
                <Text style={styles.colDesc}>Description</Text>
                <Text style={styles.colUnit}>Unit</Text>
                <Text style={styles.colQty}>Qty</Text>
                <Text style={styles.colRate}>Rate ({currency})</Text>
                <Text style={styles.colTotal}>Total ({currency})</Text>
              </View>
              {group.items.map((it) => (
                <View key={it.id} style={styles.row} wrap={false}>
                  <Text style={styles.colCode}>{it.line_number}</Text>
                  <Text style={styles.colName}>
                    {it.name ?? it.element_name ?? ""}
                  </Text>
                  <Text style={styles.colDesc}>{it.description ?? ""}</Text>
                  <Text style={styles.colUnit}>{it.unit}</Text>
                  <Text style={styles.colQty}>{formatQty(it.quantity)}</Text>
                  <Text style={styles.colRate}>{fmtMoney(it._rate)}</Text>
                  <Text style={styles.colTotal}>{fmtMoney(it._total)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>
            {currency} {fmtMoney(grandTotal)}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{branding.appName}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Render the BOQ PDF to a Node Buffer ready to attach to an email. */
export async function renderBoqPdf(input: RenderBoqPdfInput): Promise<Buffer> {
  return renderToBuffer(<BoqPdfDocument {...input} />);
}

/** Build the attachment filename — `BoQ - {project} - {YYYY-MM-DD}.pdf`. */
export function buildBoqPdfFilename(
  projectName: string,
  issuedAt?: string
): string {
  const date = issuedAt ?? new Date().toISOString().slice(0, 10);
  const safe = projectName.replace(/[^a-z0-9\-_ ]/gi, "").trim();
  return `BoQ - ${safe || "Project"} - ${date}.pdf`;
}
