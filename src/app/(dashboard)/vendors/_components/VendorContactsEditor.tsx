"use client";

import { useTranslations } from "next-intl";
import { Plus, X, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ContactDraft {
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  receivesRfq: boolean;
}

export const EMPTY_CONTACT: ContactDraft = {
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary: false,
  receivesRfq: true,
};

interface Props {
  contacts: ContactDraft[];
  onChange: (next: ContactDraft[]) => void;
}

/** Inline list editor — add/remove rows, mark a single primary, toggle RFQ recipient. */
export function VendorContactsEditor({ contacts, onChange }: Props) {
  const t = useTranslations("vendors");

  const update = (i: number, patch: Partial<ContactDraft>) => {
    onChange(contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const setPrimary = (i: number) => {
    onChange(contacts.map((c, idx) => ({ ...c, isPrimary: idx === i })));
  };

  const remove = (i: number) =>
    onChange(contacts.filter((_, idx) => idx !== i));

  const add = () => onChange([...contacts, { ...EMPTY_CONTACT }]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-text-secondary">
          {t("contactsLabel")}
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
          {t("addContact")}
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-xs text-text-muted italic">{t("noContacts")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-border-default bg-bg-input p-3 flex flex-col gap-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder={t("contactName")}
                  value={c.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <Input
                  placeholder={t("contactTitle")}
                  value={c.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder={t("contactEmail")}
                  value={c.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                />
                <Input
                  placeholder={t("contactPhone")}
                  value={c.phone}
                  onChange={(e) => update(i, { phone: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPrimary(i)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs transition-colors",
                    c.isPrimary
                      ? "text-warning font-medium"
                      : "text-text-muted hover:text-text-primary"
                  )}
                  aria-pressed={c.isPrimary}
                >
                  <Star
                    className={cn("w-3.5 h-3.5", c.isPrimary && "fill-warning")}
                  />
                  {t("primaryContact")}
                </button>
                <Checkbox
                  id={`rfq-${i}`}
                  checked={c.receivesRfq}
                  onCheckedChange={(checked) =>
                    update(i, { receivesRfq: checked })
                  }
                  label={t("receivesRfq")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  className="ml-auto text-error hover:text-error"
                  aria-label={t("removeContact")}
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
