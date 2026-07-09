"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { ArrowLeft, Edit3, ExternalLink, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { API } from "@/lib/api/routes";
import { elements as elementsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/formatCurrency";
import type { ElementWithDetails } from "@/types";
import { AvailableRatesPanel } from "../_components/AvailableRatesPanel";
import { ElementFormDialog } from "../_components/ElementFormDialog";
import {
  buildElementMutationPayload,
  type ElementSubmitValues,
} from "../_lib/elementFormPayload";

/**
 * Element detail page (spec §8). A read-only view of a library element plus the
 * active rate contracts that cover it. Complements the quick edit dialog on the
 * library list with a full, linkable surface; the same "Available Rate
 * Contracts" panel is shared with the dialog.
 */
export default function ElementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("elements");
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<ElementWithDetails>(
    API.element(id)
  );

  const handleSubmit = async (values: ElementSubmitValues) => {
    setSubmitting(true);
    try {
      await elementsApi.update(id, buildElementMutationPayload(values));
      await mutate();
      setEditOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-10">
        <Link
          href="/elements/library"
          className="inline-flex w-fit items-center gap-2 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detailBack")}
        </Link>
        <EmptyState
          icon={Package}
          title={t("detailNotFound")}
          description={t("detailNotFoundHint")}
          action={{ label: t("detailBack"), href: "/elements/library" }}
        />
      </div>
    );
  }

  const category = data.category_path?.join(" › ") ?? t("detailUncategorized");

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-10">
      <Link
        href="/elements/library"
        className="inline-flex w-fit items-center gap-2 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detailBack")}
      </Link>

      <PageHeader
        title={`${data.code} — ${data.name}`}
        subtitle={category}
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Edit3 className="h-4 w-4" />
            {t("detailEdit")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={data.is_active ? "success" : "archived"}>
          {data.is_active ? t("active") : t("archived")}
        </Badge>
        {data.tags?.map((tag) => (
          <Badge key={tag} variant="info">
            {tag}
          </Badge>
        ))}
      </div>

      {data.description && (
        <p className="text-sm text-text-secondary whitespace-pre-line">
          {data.description}
        </p>
      )}

      {data.image_url && (
        <Image
          src={data.image_url}
          alt={data.name}
          width={320}
          height={240}
          className="max-w-full rounded-lg border border-border-default object-cover"
          unoptimized
        />
      )}

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-border-default bg-bg-secondary p-4 md:grid-cols-4">
        <Field label={t("fieldCategory")}>{category}</Field>
        <Field label={t("fieldUnit")}>{data.unit}</Field>
        <Field label={t("fieldUnitCost")}>
          {formatCurrency(Number(data.unit_cost), data.currency)}
        </Field>
        <Field label={t("fieldCurrency")}>{data.currency}</Field>
        {data.spec_reference && (
          <Field label={t("fieldSpecReference")}>{data.spec_reference}</Field>
        )}
        {data.drawing_ref && (
          <Field label={t("fieldDrawingRef")}>{data.drawing_ref}</Field>
        )}
        {data.spec_file_url && (
          <Field label={t("fieldSpecFile")}>
            <FileLink url={data.spec_file_url} name={data.spec_file_name} />
          </Field>
        )}
        {data.drawing_file_url && (
          <Field label={t("fieldDrawingFile")}>
            <FileLink
              url={data.drawing_file_url}
              name={data.drawing_file_name}
            />
          </Field>
        )}
      </section>

      {data.attributes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("fieldAttributes")}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {data.attributes.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-border-default bg-bg-secondary px-3 py-1.5 text-sm"
              >
                <span className="text-text-muted">{a.attribute_key}: </span>
                <span className="text-text-primary">
                  {a.attribute_value}
                  {a.unit ? ` ${a.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AvailableRatesPanel elementId={data.id} />

      <ElementFormDialog
        open={editOpen}
        editing={data}
        submitting={submitting}
        onOpenChange={setEditOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}

function FileLink({ url, name }: { url: string; name: string | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline"
    >
      {name ?? url}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
