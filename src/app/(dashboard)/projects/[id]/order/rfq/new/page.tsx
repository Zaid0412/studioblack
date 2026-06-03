"use client";

import { use } from "react";
import { RfqCreateForm } from "./_components/RfqCreateForm";

/**
 * RFQ create flow — single-page form that gathers the header fields and a
 * checkbox-driven picker over the project's BOQ items. Multi-step splitting
 * (e.g. wizard pages) is intentionally avoided in Phase C — keep all fields
 * on one screen so users can see the full RFQ they're about to issue.
 */
export default function OrderRfqNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  return <RfqCreateForm projectId={projectId} />;
}
