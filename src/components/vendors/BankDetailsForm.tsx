"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Save, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useResyncFromProp } from "@/hooks/useResyncFromProp";
import type { BankDetails } from "@/types";

const EMPTY: Required<BankDetails> = {
  bank_name: "",
  account_holder: "",
  account_number: "",
  iban: "",
  swift: "",
  ifsc_code: "",
  branch: "",
};

/** `maxLength` mirrors `bankDetailsSchema` caps — update both together. */
const BANK_FIELDS: ReadonlyArray<{
  key: keyof BankDetails;
  labelKey: string;
  maxLength: number;
}> = [
  { key: "bank_name", labelKey: "bankName", maxLength: 255 },
  { key: "account_holder", labelKey: "accountHolder", maxLength: 255 },
  { key: "account_number", labelKey: "accountNumber", maxLength: 50 },
  { key: "iban", labelKey: "iban", maxLength: 50 },
  { key: "swift", labelKey: "swift", maxLength: 20 },
  { key: "ifsc_code", labelKey: "ifscCode", maxLength: 20 },
  { key: "branch", labelKey: "branch", maxLength: 255 },
];

interface Props {
  value: BankDetails | null;
  isLoading: boolean;
  error?: unknown;
  onSave: (data: BankDetails | null) => Promise<void>;
  /** Read-only renders the inputs disabled and hides the save/clear buttons. */
  readOnly?: boolean;
}

/**
 * Presentational bank-details form. Owns local edit state and the clear
 * confirm dialog; delegates persistence + cache invalidation to the caller
 * via `onSave`. Used by both the PM-side vendor drawer and the vendor
 * portal profile page.
 */
export function BankDetailsForm({
  value,
  isLoading,
  error,
  onSave,
  readOnly = false,
}: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");

  const [values, setValues] = useState<Required<BankDetails>>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useResyncFromProp(value, (next) => setValues({ ...EMPTY, ...(next ?? {}) }));

  const setField = (key: keyof BankDetails, v: string) =>
    setValues((s) => ({ ...s, [key]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: BankDetails = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v && v.trim())
      );
      await onSave(Object.keys(payload).length > 0 ? payload : null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    try {
      await onSave(null);
      setConfirmClear(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-error">{t("bankLoadError")}</p>;
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md bg-info/10 p-3 text-xs text-info">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t("bankNotice")}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BANK_FIELDS.map((field) => (
          <Input
            key={field.key}
            label={t(field.labelKey)}
            value={values[field.key]}
            onChange={(e) => setField(field.key, e.target.value)}
            maxLength={field.maxLength}
            disabled={readOnly}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-2">
          {value && (
            <Button
              type="button"
              variant="danger"
              disabled={submitting}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="w-4 h-4" />
              {t("clearBank")}
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            <Save className="w-4 h-4" />
            {submitting ? tCommon("loading") : tCommon("save")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t("confirmClearBankTitle")}
        description={t("confirmClearBankDesc")}
        confirmLabel={t("clearBank")}
        cancelLabel={tCommon("cancel")}
        destructive
        submitting={submitting}
        onConfirm={handleClear}
      />
    </form>
  );
}
