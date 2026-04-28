"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Copy,
  Edit3,
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
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Element } from "@/types";
import { formatMoney } from "../_lib/formatters";

interface Props {
  rows: Element[];
  isLoading: boolean;
  categoryMap: Map<string, string>;
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
  onRowClick,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: Props) {
  const t = useTranslations("elements");

  return (
    <div className="rounded-[10px] bg-bg-secondary border border-border-default overflow-hidden">
      <div className="hidden lg:grid grid-cols-[40px_140px_1fr_160px_80px_140px_60px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
        <div></div>
        <div>{t("colCode")}</div>
        <div>{t("colName")}</div>
        <div>{t("colCategory")}</div>
        <div>{t("colUnit")}</div>
        <div className="text-right">{t("colUnitCost")}</div>
        <div className="text-right">{t("colActions")}</div>
      </div>

      <div className="flex flex-col">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} columns={7} />
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
                el.category_id ? (categoryMap.get(el.category_id) ?? "—") : "—"
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

  const attachedFileNames: string[] = [];
  if (element.drawing_file_url)
    attachedFileNames.push(element.drawing_file_name ?? t("fieldDrawingFile"));
  if (element.spec_file_url)
    attachedFileNames.push(element.spec_file_name ?? t("fieldSpecFile"));

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-1 lg:grid-cols-[40px_140px_1fr_160px_80px_140px_60px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-center">
        {element.image_url ? (
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
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm text-text-primary truncate">
          {element.code}
        </span>
        {element.version_number > 1 && (
          <Badge
            variant="info"
            className="shrink-0 font-mono text-[10px] px-2 py-0.5"
          >
            {t("versionN", { n: element.version_number })}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-text-primary truncate">
          {element.name}
        </span>
        {!element.is_active && (
          <Badge variant="archived" className="shrink-0">
            {t("archived")}
          </Badge>
        )}
        {attachedFileNames.length > 0 && (
          <TooltipProvider>
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
          </TooltipProvider>
        )}
      </div>
      <div className="text-sm text-text-secondary truncate">{categoryName}</div>
      <div className="text-sm text-text-secondary">{element.unit}</div>
      <div className="text-sm text-text-primary lg:text-right font-mono">
        {formatMoney(element.unit_cost, element.currency)}
      </div>
      <div
        className="flex items-center lg:justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Actions">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </div>
    </div>
  );
}
