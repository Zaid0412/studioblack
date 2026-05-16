"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatDate";
import { useVendorRfqDetail } from "@/hooks/useRfqs";
import { RfqStatusBadge } from "../../../projects/[id]/boq/rfq/_components/RfqStatusBadge";

/**
 * Vendor-portal RFQ detail. Read-only in F9 — the "Submit Quote" CTA is
 * disabled with a tooltip pointing at F10. We deliberately don't show who
 * else was invited (competitive info; the API strips it for vendor callers).
 */
export default function VendorPortalRfqDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = use(params);
  const t = useTranslations("vendorPortal.rfqDetail");

  const { rfq, notFound, isLoading } = useVendorRfqDetail(rfqId);

  if (isLoading) {
    return <p className="text-sm text-text-muted">{t("loading")}</p>;
  }
  if (notFound || !rfq) {
    return (
      <div className="flex flex-col gap-4 max-w-[1100px]">
        <Link
          href="/vendor-portal/rfqs"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <p className="text-sm text-text-muted">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1100px]">
      <Link
        href="/vendor-portal/rfqs"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </Link>

      <PageHeader
        title={rfq.title}
        subtitle={`${rfq.rfq_number} · ${
          rfq.issued_date ? formatDate(rfq.issued_date) : ""
        }`}
        actions={
          <>
            <RfqStatusBadge status={rfq.status} />
            <Button disabled title={t("submitComingSoon")}>
              {t("submitBtn")}
            </Button>
          </>
        }
      />

      <section className="rounded-xl border border-border-default bg-bg-secondary p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Detail
          label={t("responseDeadline")}
          value={
            rfq.response_deadline ? formatDate(rfq.response_deadline) : "—"
          }
        />
        <Detail label={t("scope")} value={rfq.scope_of_work ?? "—"} multiline />
        <Detail
          label={t("terms")}
          value={rfq.terms_conditions ?? "—"}
          multiline
        />
      </section>

      <section className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("itemsHeading", { count: rfq.items.length })}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated text-text-muted">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">
                  {t("col.description")}
                </th>
                <th className="px-4 py-2.5 font-medium">{t("col.unit")}</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  {t("col.quantity")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("col.specNotes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((it) => (
                <tr key={it.id} className="border-t border-border-default">
                  <td className="px-4 py-3 text-text-primary">
                    {it.description}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{it.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                    {it.quantity}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {it.spec_notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${multiline ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span
        className={`text-sm text-text-primary ${
          multiline ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
