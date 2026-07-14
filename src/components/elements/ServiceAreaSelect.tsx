"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import {
  CategoryPickerEmpty,
  CategoryRow,
  CategoryTrigger,
} from "@/components/elements/CategoryPickerParts";
import {
  SERVICE_AREA_DEPTH,
  buildCategoryIndex,
  flattenCategories,
} from "@/app/(dashboard)/elements/_lib/categoryUtils";
import type { ElementCategoryNode } from "@/types";

/**
 * The create dialog a picker delegates to. Creating is always delegated — the
 * picker owns the open state and selects whatever `onCreated` hands back, but
 * it never decides *what* gets created. Every caller today builds a Service
 * Area (`serviceAreaCreate`); a picker that wants no create passes none.
 */
export type CategoryCreateRender = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) => React.ReactNode;

interface Props {
  /** A Service Area id — or, on a grandfathered record, a shallower node. */
  value: string | null;
  onChange: (id: string | null) => void;
  tree: ElementCategoryNode[];
  label?: string;
  placeholder?: string;
  /** The create dialog. Omit it and the picker has no create affordance. */
  renderCreate?: CategoryCreateRender;
  /** Read-only: the trigger won't open. Mirrors the other form controls. */
  disabled?: boolean;
  /** Marks the label with the same `*` the other form controls use. */
  required?: boolean;
}

/** Where the drill is standing. Ids, not nodes — see `cursor` below. */
interface Cursor {
  catId: string | null;
  subId: string | null;
}

const ROOT: Cursor = { catId: null, subId: null };

/**
 * Pick a Service Area by drilling: Category → Sub-category → Service Area, one
 * list at a time, with a breadcrumb to climb back out.
 *
 * A flat list of every node was fine, and stops being fine somewhere around a
 * few hundred leaves — "Base Cabinets" is meaningless without "Kitchen ›
 * Cabinets" above it, so the flat list had to carry the ancestors too, greyed
 * out and unclickable, tripling its length to say nothing. Drilling shows the
 * ancestors *as the path you walked*, and only leaves are ever clickable, so an
 * invalid Category/Service Area pairing is unrepresentable rather than merely
 * discouraged.
 *
 * Searching escapes the drill entirely: it matches the full breadcrumb across
 * every leaf, so someone who knows what they want types "base" and takes it in
 * one click. That is the expert path; drilling is the learning one.
 */
export function ServiceAreaSelect({
  value,
  onChange,
  tree,
  label,
  placeholder,
  renderCreate,
  disabled = false,
  required = false,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  const [createOpen, setCreateOpen] = useState(false);

  // Ids, not node references: the tree is an SWR resource, so it is replaced
  // wholesale on every revalidation and any node we held onto would go stale.
  const [cursor, setCursor] = useState<Cursor>(ROOT);

  const options = useMemo(() => flattenCategories(tree), [tree]);
  const index = useMemo(() => buildCategoryIndex(tree), [tree]);
  const leaves = useMemo(
    () => options.filter((o) => o.depth === SERVICE_AREA_DEPTH),
    [options]
  );

  const selected = (value && options.find((o) => o.id === value)) || null;

  const cat = cursor.catId
    ? (tree.find((n) => n.id === cursor.catId) ?? null)
    : null;
  const sub =
    cat && cursor.subId
      ? (cat.children.find((n) => n.id === cursor.subId) ?? null)
      : null;
  // Derived, never stored — a stored level desyncs from the cursor.
  const depth = sub ? 2 : cat ? 1 : 0;
  const rows = sub ? sub.children : cat ? cat.children : tree;

  /**
   * Open where the value already lives, so the common case — "this is wrong,
   * give me the one next to it" — costs no drilling at all. A value naming a
   * Category or Sub-category (grandfathered, or nothing resolves because the
   * tree hasn't loaded) lands on that node's own children, which is exactly the
   * list you must choose from to make the record valid.
   */
  const seedCursor = (open: boolean) => {
    if (!open) return;
    const loc = value ? index.get(value) : undefined;
    setCursor(
      loc ? { catId: loc.category.id, subId: loc.sub?.id ?? null } : ROOT
    );
  };

  const commit = (id: string, close: () => void) => {
    onChange(id);
    close();
  };

  // The path you walked, as the way back out. The crumb you're standing on goes
  // nowhere, so it renders as text rather than a button.
  const crumbs = [
    { key: "root", name: t("allCategories"), target: ROOT },
    ...(cat
      ? [
          {
            key: cat.id,
            name: cat.name,
            target: { catId: cat.id, subId: null },
          },
        ]
      : []),
    ...(sub ? [{ key: sub.id, name: sub.name, target: cursor }] : []),
  ];

  const emptyLabel =
    depth === SERVICE_AREA_DEPTH
      ? t("serviceAreaNoServiceAreas")
      : depth === 1
        ? t("serviceAreaNoSubcategories")
        : t("categoryEmpty");

  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <SearchableDropdown
        minContentWidth={300}
        maxListHeight={240}
        isEmpty={false}
        onOpenChange={seedCursor}
        headerSlot={
          renderCreate
            ? (close) => (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setCreateOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent hover:bg-accent/10 border-b border-border-default transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t("newServiceArea")}
                </button>
              )
            : undefined
        }
        // Hidden while searching: search leaves the drill behind entirely, and a
        // breadcrumb pointing at a branch you aren't looking at is a lie.
        subheaderSlot={(query) =>
          query ? null : (
            <nav
              aria-label={t("serviceAreaBreadcrumbLabel")}
              className="flex items-center gap-1 flex-wrap px-3 py-2 text-xs bg-bg-elevated border-b border-border-default"
            >
              {crumbs.map((crumb, i) => {
                const here = i === crumbs.length - 1;
                return (
                  <span key={crumb.key} className="flex items-center gap-1">
                    {i > 0 && (
                      <ChevronRight className="h-3 w-3 text-text-muted shrink-0" />
                    )}
                    {here ? (
                      <span className="font-medium text-text-primary">
                        {crumb.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCursor(crumb.target)}
                        className="rounded px-1 py-0.5 text-accent hover:bg-accent/10 transition-colors"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                );
              })}
            </nav>
          )
        }
        trigger={
          <CategoryTrigger
            selected={selected}
            placeholder={placeholder ?? t("serviceAreaPlaceholder")}
            disabled={disabled}
          />
        }
      >
        {(query, close) => {
          if (query) {
            // Match on the full breadcrumb, so "kitchen ca" finds a leaf its own
            // name doesn't contain — and only leaves are offered, because search
            // is a shortcut through the drill, not a way around its one rule.
            const hits = leaves.filter((o) =>
              o.label.toLowerCase().includes(query)
            );
            if (hits.length === 0) {
              return (
                <CategoryPickerEmpty>
                  {tCommon("noResults")}
                </CategoryPickerEmpty>
              );
            }
            return hits.map((o) => (
              <CategoryRow
                key={o.id}
                icon={o.icon}
                color={o.color}
                name={o.name}
                path={o.label}
                selected={value === o.id}
                onClick={() => commit(o.id, close)}
              />
            ));
          }

          if (rows.length === 0) {
            return <CategoryPickerEmpty>{emptyLabel}</CategoryPickerEmpty>;
          }

          return (
            <div
              // Re-mounted per level so the incoming list animates in — the swap
              // is the only thing telling you that you moved.
              key={`${cursor.catId ?? ""}/${cursor.subId ?? ""}`}
              className="animate-in fade-in slide-in-from-right-2 duration-150 ease-out motion-reduce:animate-none"
            >
              {rows.map((node) => (
                <CategoryRow
                  key={node.id}
                  icon={node.icon}
                  color={node.color}
                  name={node.name}
                  selected={depth === SERVICE_AREA_DEPTH && value === node.id}
                  onClick={() =>
                    depth === SERVICE_AREA_DEPTH
                      ? commit(node.id, close)
                      : // Descending is navigation, not selection: `onChange`
                        // only ever fires for a leaf.
                        setCursor(
                          depth === 0
                            ? { catId: node.id, subId: null }
                            : { catId: cursor.catId, subId: node.id }
                        )
                  }
                  trailing={
                    depth < SERVICE_AREA_DEPTH ? (
                      <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                    ) : undefined
                  }
                />
              ))}
            </div>
          );
        }}
      </SearchableDropdown>

      {renderCreate?.({
        open: createOpen,
        onOpenChange: setCreateOpen,
        onCreated: (id) => {
          onChange(id);
          setCreateOpen(false);
        },
      })}
    </div>
  );
}
