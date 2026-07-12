"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Copy,
  Edit3,
  Eye,
  Archive,
  ArchiveRestore,
  Layers,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { LabelValueList } from "@/components/ui/LabelValueList";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SortableHeaderButton,
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";
import type { Element } from "@/types";
import type { ElementSortField, SortOrder } from "@/lib/validations";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { formatMoney } from "../_lib/formatters";

type SortKey = ElementSortField;

/**
 * Desktop grid template for the elements table — shared between the
 * header and every row so the columns line up. The `Name` column is a
 * `minmax` so it grows on wide screens but never collapses below 200px.
 */
const GRID_COLS = "grid-cols-[40px_140px_minmax(200px,1fr)_160px_140px_60px]";

/**
 * Sum of fixed widths (40 + 140 + 200 + 160 + 140 + 60 = 740) + 5
 * inter-column gaps (5 × 16 = 80) + 2 × 16 horizontal padding = 852px.
 * Round to 860 for breathing room. Applied as `min-w` on the
 * scrollable wrapper so the columns never squish below the declared
 * sizes; below the threshold the wrapper scrolls horizontally instead,
 * keeping header and rows aligned.
 */
const TABLE_MIN_WIDTH = "lg:min-w-[860px]";

interface Props {
  rows: Element[];
  isLoading: boolean;
  categoryMap: Map<string, string>;
  sortBy: SortKey | null;
  sortOrder: SortOrder | null;
  onSortChange: (sortBy: SortKey | null, sortOrder: SortOrder | null) => void;
  onRowClick: (el: Element) => void;
  onEdit: (el: Element) => void;
  onDuplicate: (el: Element) => void;
  onArchive: (el: Element) => void;
  onRestore: (el: Element) => void;
}

/** Tabular list of elements with per-row action menu (edit, duplicate, archive/restore). */
export function ElementTable({
  rows,
  isLoading,
  categoryMap,
  sortBy,
  sortOrder,
  onSortChange,
  onRowClick,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: Props) {
  const t = useTranslations("elements");
  const listRef = useStaggerReveal<HTMLDivElement>(
    rows.map((el) => el.id).join(",")
  );

  const sortConfig: SortConfig<SortKey> =
    sortBy && sortOrder ? { key: sortBy, direction: sortOrder } : null;
  const onSort = (key: SortKey) => {
    const next = nextSortDirection(sortConfig, key);
    onSortChange(next?.key ?? null, next?.direction ?? null);
  };

  return (
    <TooltipProvider>
      <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden">
        <div className="lg:overflow-x-auto">
          <div ref={listRef} className={TABLE_MIN_WIDTH}>
            <div
              className={`hidden lg:grid ${GRID_COLS} gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide`}
            >
              <div></div>
              <SortableHeaderButton
                sortKey="code"
                config={sortConfig}
                onSort={onSort}
                className="w-full"
              >
                {t("colCode")}
              </SortableHeaderButton>
              <SortableHeaderButton
                sortKey="name"
                config={sortConfig}
                onSort={onSort}
                className="w-full"
              >
                {t("colName")}
              </SortableHeaderButton>
              <div>{t("colCategory")}</div>
              <SortableHeaderButton
                sortKey="unit_cost"
                config={sortConfig}
                onSort={onSort}
                align="right"
                className="w-full"
              >
                {t("colUnitCost")}
              </SortableHeaderButton>
              <div className="text-right">{t("colActions")}</div>
            </div>

            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} columns={6} />
              ))
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t("noResults")}
                description={t("noResultsHint")}
              />
            ) : (
              rows.map((el) => (
                <ElementRow
                  key={el.id}
                  element={el}
                  categoryName={
                    el.category_id
                      ? (categoryMap.get(el.category_id) ?? "—")
                      : "—"
                  }
                  onClick={() => onRowClick(el)}
                  onEdit={() => onEdit(el)}
                  onDuplicate={() => onDuplicate(el)}
                  onArchive={() => onArchive(el)}
                  onRestore={() => onRestore(el)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface RowProps {
  element: Element;
  categoryName: string;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

function ElementRow({
  element,
  categoryName,
  onClick,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: RowProps) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const attachedFileNames = [
    element.drawing_file_url &&
      (element.drawing_file_name ?? t("fieldDrawingFile")),
    element.spec_file_url && (element.spec_file_name ?? t("fieldSpecFile")),
  ].filter(Boolean) as string[];

  const thumbnail = element.image_url ? (
    <Image
      src={element.image_url}
      alt=""
      width={32}
      height={32}
      className="rounded-md object-cover h-8 w-8"
      unoptimized
    />
  ) : (
    <div className="h-8 w-8 rounded-md bg-bg-elevated flex items-center justify-center">
      <Layers className="w-3.5 h-3.5 text-text-muted" />
    </div>
  );

  const attachmentIcon = attachedFileNames.length > 0 && (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="shrink-0 text-text-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <Paperclip className="w-3.5 h-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="text-xs">
          {attachedFileNames.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );

  const versionBadge = element.version_number > 1 && (
    <Badge
      variant="info"
      className="shrink-0 font-mono text-[10px] px-2 py-0.5"
    >
      {t("versionN", { n: element.version_number })}
    </Badge>
  );

  const archivedBadge = !element.is_active && (
    <Badge variant="archived" className="shrink-0">
      {t("archived")}
    </Badge>
  );

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/elements/${element.id}`}>
            <Eye className="w-4 h-4" />
            {t("detailView")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Edit3 className="w-4 h-4" />
          {tCommon("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="w-4 h-4" />
          {t("duplicate")}
        </DropdownMenuItem>
        {element.is_active ? (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="w-4 h-4" />
            {t("archive")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onRestore}>
            <ArchiveRestore className="w-4 h-4" />
            {t("restore")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      data-anim-item
      onClick={onClick}
      className="border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors cursor-pointer"
    >
      <div className="lg:hidden flex flex-col gap-2 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{thumbnail}</div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-text-primary truncate">
                {element.code}
              </span>
              {versionBadge}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-text-primary truncate">
                {element.name}
              </span>
              {archivedBadge}
              {attachmentIcon}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>{actionsMenu}</div>
        </div>
        <LabelValueList
          items={[
            {
              label: t("colCategory"),
              value: categoryName,
              valueClassName: "truncate",
            },
            { label: t("colUnit"), value: element.unit },
            {
              label: t("colUnitCost"),
              value: formatMoney(element.unit_cost, element.currency),
              valueClassName: "text-text-primary font-mono",
            },
          ]}
        />
      </div>

      <div className={`hidden lg:grid ${GRID_COLS} gap-4 px-4 py-3`}>
        <div className="flex items-center justify-center">{thumbnail}</div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm text-text-primary truncate">
            {element.code}
          </span>
          {versionBadge}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-text-primary truncate">
            {element.name}
          </span>
          {archivedBadge}
          {attachmentIcon}
        </div>
        <div className="text-sm text-text-secondary truncate">
          {categoryName}
        </div>
        <div className="text-sm text-text-primary text-right font-mono">
          {formatMoney(element.unit_cost, element.currency)}
        </div>
        <div
          className="flex items-center justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          {actionsMenu}
        </div>
      </div>
    </div>
  );
}
