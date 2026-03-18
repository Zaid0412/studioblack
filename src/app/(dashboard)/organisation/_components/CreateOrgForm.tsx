"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CreateOrgFormProps {
  orgName: string;
  setOrgName: (v: string) => void;
  orgSlug: string;
  setOrgSlug: (v: string) => void;
  isCreating: boolean;
  generateSlug: (name: string) => string;
  handleCreateOrg: () => void;
}

/** Form for creating a new organisation with name and slug. */
export function CreateOrgForm({
  orgName,
  setOrgName,
  orgSlug,
  setOrgSlug,
  isCreating,
  generateSlug,
  handleCreateOrg,
}: CreateOrgFormProps) {
  const t = useTranslations("organisation");

  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <PageHeader title={t("title")} subtitle={t("noOrgSubtitle")} />

      <Card>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {t("createTitle")}
              </h3>
              <p className="text-sm text-text-muted">{t("createSubtitle")}</p>
            </div>
          </div>

          <Separator />

          <Input
            label={t("orgName")}
            placeholder={t("orgNamePlaceholder")}
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value);
              setOrgSlug(generateSlug(e.target.value));
            }}
          />
          <Input
            label={t("slug")}
            placeholder={t("slugPlaceholder")}
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
          />
          <Button
            className="self-start"
            onClick={handleCreateOrg}
            disabled={isCreating || !orgName.trim() || !orgSlug.trim()}
          >
            {isCreating ? t("creating") : t("createButton")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
