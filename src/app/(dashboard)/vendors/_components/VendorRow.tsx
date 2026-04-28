"use client";

import { useTranslations } from "next-intl";
import { MoreHorizontal, Edit3, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { VendorListRow } from "@/lib/api/vendors";
import { VendorStatusBadge } from "./VendorStatusBadge";
import { VendorRatingPicker } from "./VendorRatingPicker";

interface Props {
  vendor: VendorListRow;
  canDelete: boolean;
  onClick: () => void;
  onEdit: () => void;
  onSoftDelete: () => void;
  onHardDelete: () => void;
}

/** Single row in the vendors table — opens the drawer on click. */
export function VendorRow({
  vendor,
  canDelete,
  onClick,
  onEdit,
  onSoftDelete,
  onHardDelete,
}: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-1 lg:grid-cols-[140px_1fr_120px_220px_80px_140px_60px] gap-2 lg:gap-4 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated transition-colors cursor-pointer"
    >
      <div className="font-mono text-sm text-text-primary truncate">
        {vendor.vendor_code || "—"}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-text-primary truncate">
          {vendor.company_name}
        </span>
        {vendor.trading_name && (
          <span className="text-xs text-text-muted truncate">
            {vendor.trading_name}
          </span>
        )}
      </div>
      <div>
        <VendorStatusBadge status={vendor.status} />
      </div>
      <div className="text-sm text-text-secondary truncate">
        {vendor.primary_contact_email ?? (
          <span className="text-text-muted italic">{t("noPrimary")}</span>
        )}
      </div>
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        <Star className="w-3.5 h-3.5 text-text-muted shrink-0" />
        {vendor.trade_count}
      </div>
      <div>
        <VendorRatingPicker
          value={Number(vendor.rating ?? 0)}
          readOnly
          size="sm"
        />
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
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                {vendor.status !== "inactive" && (
                  <DropdownMenuItem onClick={onSoftDelete}>
                    <Trash2 className="w-4 h-4" />
                    {t("markInactive")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem destructive onClick={onHardDelete}>
                  <Trash2 className="w-4 h-4" />
                  {t("deletePermanent")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
