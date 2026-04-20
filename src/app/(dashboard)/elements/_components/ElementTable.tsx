"use client";

import { useTranslations } from "next-intl";
import {
  MoreHorizontal,
  Copy,
  Edit3,
  Archive,
  ArchiveRestore,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Element, ElementCategoryNode } from "@/types";
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
      <div className="hidden lg:grid grid-cols-[140px_1fr_160px_80px_140px_60px] gap-4 px-4 py-3 border-b border-border-default text-xs font-medium text-text-muted uppercase tracking-wide">
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

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-1 lg:grid-cols-[140px_1fr_160px_80px_140px_60px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors cursor-pointer"
    >
      <div className="font-mono text-sm text-text-primary truncate">
        {element.code}
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

/** Flatten the category tree into id → name map for table display. */
export function buildCategoryMap(
  tree: ElementCategoryNode[]
): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: ElementCategoryNode[]) => {
    for (const n of nodes) {
      map.set(n.id, n.name);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(tree);
  return map;
}
