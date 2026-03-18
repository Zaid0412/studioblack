"use client";

import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OrgDetailsCardProps {
  name: string;
  slug: string;
  memberCount: number;
}

/** Card displaying organisation name, slug, and member count. */
export function OrgDetailsCard({
  name,
  slug,
  memberCount,
}: OrgDetailsCardProps) {
  const t = useTranslations("organisation");

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10">
          <Building2 className="w-6 h-6 text-accent" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-text-primary">
            {name}
          </span>
          <span className="text-sm text-text-muted">{slug}</span>
        </div>
        <Badge variant="info" className="ml-auto">
          {memberCount} {t("membersCount")}
        </Badge>
      </div>
    </Card>
  );
}
