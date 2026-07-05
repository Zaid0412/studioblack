import { useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { elementCategories } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import type { CategoryFormSubmit } from "@/components/elements/CategoryForm";
import type { ElementCategory } from "@/types";

/**
 * Shared submit handler for the "create category" flow used by
 * CategorySelect and the Categories management page — manages the in-flight flag,
 * revalidates the categories cache, toasts on success/error, and runs
 * `onCreated` only on success (matching the prior call-site behaviour
 * where the dialog stayed open on error so the user could retry).
 */
export function useCreateCategory(
  onCreated?: (category: ElementCategory) => void
) {
  const t = useTranslations("elements");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (values: CategoryFormSubmit) => {
    setSubmitting(true);
    try {
      const created = (await elementCategories.create(
        values
      )) as ElementCategory;
      await globalMutate(API.elementCategories());
      toast({ title: t("categoryCreatedToast") });
      onCreated?.(created);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, handleCreate };
}
