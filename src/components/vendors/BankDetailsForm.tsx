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
  branch: "",
};

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
        <Input
          label={t("bankName")}
          value={values.bank_name}
          onChange={(e) => setField("bank_name", e.target.value)}
          maxLength={255}
          disabled={readOnly}
        />
        <Input
          label={t("accountHolder")}
          value={values.account_holder}
          onChange={(e) => setField("account_holder", e.target.value)}
          maxLength={255}
          disabled={readOnly}
        />
        <Input
          label={t("accountNumber")}
          value={values.account_number}
          onChange={(e) => setField("account_number", e.target.value)}
          maxLength={50}
          disabled={readOnly}
        />
        <Input
          label={t("iban")}
          value={values.iban}
          onChange={(e) => setField("iban", e.target.value)}
          maxLength={50}
          disabled={readOnly}
        />
        <Input
          label={t("swift")}
          value={values.swift}
          onChange={(e) => setField("swift", e.target.value)}
          maxLength={20}
          disabled={readOnly}
        />
        <Input
          label={t("branch")}
          value={values.branch}
          onChange={(e) => setField("branch", e.target.value)}
          maxLength={255}
          disabled={readOnly}
        />
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
