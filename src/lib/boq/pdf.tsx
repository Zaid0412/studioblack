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
import type { BoqItemWithComputed } from "@/types";

/**
 * Server-side renderer for the BOQ PDF attached to the
 * "sent to client" email. Renders a client-only view: code, name,
 * description, unit, qty, rate, line total, plus a section-grouped
 * table and a grand total at the bottom.
 *
 * The PDF deliberately omits all internal cost/margin breakdown
 * (unit_cost, overhead, service charge, margin %, budget rate) —
 * the client should see exactly what they'd see in the portal.
 *
 * Rendered with `@react-pdf/renderer` to stay Vercel-friendly
 * (no Chromium dependency). Wider tables are not paginated by
 * column — the layout is sized to fit A4 landscape if needed.
 */

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

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
  // Column widths (sum = 100 for landscape A4)
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

export interface RenderBoqPdfInput {
  projectName: string;
  boqTitle: string;
  currency: string;
  /** Free-text note from the PM submitting the BOQ. Optional. */
  comment?: string | null;
  /** ISO date string for the header. Defaults to today (UTC). */
  issuedAt?: string;
  items: ReadonlyArray<RenderItem>;
}

/** Format a numeric string as currency. Falls back to `0.00`. */
function fmtMoney(value: string | number | null | undefined): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtQty(value: string | number | null | undefined): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

/**
 * Pick the per-unit client rate. `client_rate` is the manual override
 * (preferred when set); otherwise derive it from `sell_price / quantity`
 * so the row shows a meaningful per-unit number.
 */
function pickClientRate(item: RenderItem): number {
  const override = Number.parseFloat(item.client_rate ?? "");
  if (Number.isFinite(override) && override > 0) return override;
  const qty = Number.parseFloat(item.quantity);
  const sell = Number.parseFloat(item.sell_price);
  if (!Number.isFinite(qty) || qty === 0 || !Number.isFinite(sell)) return 0;
  return sell / qty;
}

function pickLineTotal(item: RenderItem): number {
  const override = Number.parseFloat(item.client_rate ?? "");
  const qty = Number.parseFloat(item.quantity);
  if (Number.isFinite(override) && override > 0 && Number.isFinite(qty)) {
    return override * qty;
  }
  const sell = Number.parseFloat(item.sell_price);
  return Number.isFinite(sell) ? sell : 0;
}

/**
 * Group items by section title, preserving the input order. Items
 * without a section land under "Other items" so they still appear.
 */
function groupBySection(
  items: ReadonlyArray<RenderItem>
): Array<{ title: string; items: RenderItem[] }> {
  const groups: Array<{ title: string; items: RenderItem[] }> = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const title = item.section_title ?? "Other items";
    let i = index.get(title);
    if (i === undefined) {
      i = groups.length;
      index.set(title, i);
      groups.push({ title, items: [] });
    }
    groups[i].items.push(item);
  }
  return groups;
}

const logoPath = path.join(process.cwd(), "public", "logo.png");

function BoqPdfDocument({
  projectName,
  boqTitle,
  currency,
  comment,
  issuedAt,
  items,
}: RenderBoqPdfInput) {
  const grandTotal = items.reduce((sum, it) => sum + pickLineTotal(it), 0);
  const groups = groupBySection(items);
  const issuedDate = issuedAt ?? new Date().toISOString().slice(0, 10);

  return (
    <Document
      title={`BoQ — ${projectName}`}
      author={branding.appName}
      subject={`Bill of Quantities for ${projectName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          {/* @react-pdf/renderer's Image is a PDF primitive, not a DOM <img>. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoPath} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.titleSmall}>BILL OF QUANTITIES</Text>
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

        {groups.map((group, gi) => (
          <View key={`g-${gi}`} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text>{group.title}</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={styles.colCode}>Code</Text>
              <Text style={styles.colName}>Item</Text>
              <Text style={styles.colDesc}>Description</Text>
              <Text style={styles.colUnit}>Unit</Text>
              <Text style={styles.colQty}>Qty</Text>
              <Text style={styles.colRate}>Rate ({currency})</Text>
              <Text style={styles.colTotal}>Total ({currency})</Text>
            </View>
            {group.items.map((it) => (
              <View key={it.id} style={styles.row} wrap={false}>
                <Text style={styles.colCode}>{it.item_code}</Text>
                <Text style={styles.colName}>
                  {it.name ?? it.element_name ?? ""}
                </Text>
                <Text style={styles.colDesc}>{it.description ?? ""}</Text>
                <Text style={styles.colUnit}>{it.unit}</Text>
                <Text style={styles.colQty}>{fmtQty(it.quantity)}</Text>
                <Text style={styles.colRate}>
                  {fmtMoney(pickClientRate(it))}
                </Text>
                <Text style={styles.colTotal}>
                  {fmtMoney(pickLineTotal(it))}
                </Text>
              </View>
            ))}
          </View>
        ))}

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

/**
 * Render the BOQ PDF to a Node Buffer ready to attach to an email.
 * Pure function — no logging, no DB calls — so callers can wrap it
 * with their own error handling.
 */
export async function renderBoqPdf(input: RenderBoqPdfInput): Promise<Buffer> {
  return renderToBuffer(<BoqPdfDocument {...input} />);
}

/** Build a stable filename for the PDF attachment. */
export function buildBoqPdfFilename(
  projectName: string,
  issuedAt?: string
): string {
  const date = issuedAt ?? new Date().toISOString().slice(0, 10);
  const safe = projectName.replace(/[^a-z0-9\-_ ]/gi, "").trim();
  return `BoQ - ${safe || "Project"} - ${date}.pdf`;
}
