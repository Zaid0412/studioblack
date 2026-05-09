"use client";

import { useTranslations } from "next-intl";
import { Plus, X, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AddressDraft {
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  isPrimary: boolean;
}

export const EMPTY_ADDRESS: AddressDraft = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "",
  isPrimary: false,
};

interface Props {
  addresses: AddressDraft[];
  onChange: (next: AddressDraft[]) => void;
}

/**
 * Multi-address editor — same shape as `VendorContactsEditor`. Each card
 * carries an optional label (HQ / Warehouse / Billing), the six address
 * lines, a "primary" star toggle, and a remove button. Mirrors the
 * primary-contact UX so the two surfaces feel consistent.
 *
 * If the list is empty, the first address added is auto-marked primary.
 */
export function VendorAddressesEditor({ addresses, onChange }: Props) {
  const t = useTranslations("vendors");

  const update = (i: number, patch: Partial<AddressDraft>) => {
    onChange(addresses.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  const setPrimary = (i: number) => {
    onChange(addresses.map((a, idx) => ({ ...a, isPrimary: idx === i })));
  };

  const remove = (i: number) => {
    const next = addresses.filter((_, idx) => idx !== i);
    // If we removed the primary, promote the first remaining row so the
    // vendor never ends up with N addresses and zero primaries.
    if (next.length > 0 && !next.some((a) => a.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange(next);
  };

  const add = () => {
    const next: AddressDraft = {
      ...EMPTY_ADDRESS,
      isPrimary: addresses.length === 0,
    };
    onChange([...addresses, next]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("addressesLabel")}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
          {t("addAddress")}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t("noAddresses")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-border-default bg-bg-input p-3 flex flex-col gap-2"
            >
              <Input
                placeholder={t("addressLabelPlaceholder")}
                value={a.label}
                onChange={(e) => update(i, { label: e.target.value })}
                maxLength={50}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder={t("addrLine1")}
                  value={a.line1}
                  onChange={(e) => update(i, { line1: e.target.value })}
                  maxLength={255}
                />
                <Input
                  placeholder={t("addrLine2")}
                  value={a.line2}
                  onChange={(e) => update(i, { line2: e.target.value })}
                  maxLength={255}
                />
                <Input
                  placeholder={t("addrCity")}
                  value={a.city}
                  onChange={(e) => update(i, { city: e.target.value })}
                  maxLength={100}
                />
                <Input
                  placeholder={t("addrRegion")}
                  value={a.region}
                  onChange={(e) => update(i, { region: e.target.value })}
                  maxLength={100}
                />
                <Input
                  placeholder={t("addrPostal")}
                  value={a.postal}
                  onChange={(e) => update(i, { postal: e.target.value })}
                  maxLength={20}
                />
                <Input
                  placeholder={t("addrCountry")}
                  value={a.country}
                  onChange={(e) => update(i, { country: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPrimary(i)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs transition-colors",
                    a.isPrimary
                      ? "text-warning font-medium"
                      : "text-text-muted hover:text-text-primary"
                  )}
                  aria-pressed={a.isPrimary}
                >
                  <Star
                    className={cn("w-3.5 h-3.5", a.isPrimary && "fill-warning")}
                  />
                  {t("primaryAddress")}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  className="ml-auto text-error hover:text-error"
                  aria-label={t("removeAddress")}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
