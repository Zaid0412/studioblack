"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Save, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useVendorBankDetails } from "@/hooks/useVendors";
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
  vendorId: string;
  enabled: boolean;
}

/**
 * PM-only form for the vendor's bank details. Loads lazily once `enabled`
 * flips to true (gates the audited GET behind explicit user intent), encrypts
 * server-side on save, and clears the row when the user opts out.
 */
export function VendorBankDetailsForm({ vendorId, enabled }: Props) {
  const t = useTranslations("vendors");
  const tCommon = useTranslations("common");
  const { bankDetails, isLoading, error, save } = useVendorBankDetails(
    vendorId,
    enabled
  );

  const [values, setValues] = useState<Required<BankDetails>>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setValues({ ...EMPTY, ...(bankDetails ?? {}) });
  }, [bankDetails]);

  const setField = (key: keyof BankDetails, v: string) =>
    setValues((s) => ({ ...s, [key]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: BankDetails = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v && v.trim())
      );
      await save(Object.keys(payload).length > 0 ? payload : null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    try {
      await save(null);
      setConfirmClear(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;

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
        />
        <Input
          label={t("accountHolder")}
          value={values.account_holder}
          onChange={(e) => setField("account_holder", e.target.value)}
          maxLength={255}
        />
        <Input
          label={t("accountNumber")}
          value={values.account_number}
          onChange={(e) => setField("account_number", e.target.value)}
          maxLength={50}
        />
        <Input
          label={t("iban")}
          value={values.iban}
          onChange={(e) => setField("iban", e.target.value)}
          maxLength={50}
        />
        <Input
          label={t("swift")}
          value={values.swift}
          onChange={(e) => setField("swift", e.target.value)}
          maxLength={20}
        />
        <Input
          label={t("branch")}
          value={values.branch}
          onChange={(e) => setField("branch", e.target.value)}
          maxLength={255}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {bankDetails && (
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
