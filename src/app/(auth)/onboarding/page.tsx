"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { authClient } from "@/lib/authClient";
import { useSplashRevealClass } from "@/hooks/useSplashDone";

/** Onboarding page — PM creates their organisation after first sign-up. */
export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const revealClass = useSplashRevealClass();

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setOrgName(value);
    setSlug(generateSlug(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const { error } = await authClient.organization.create({
      name: orgName.trim(),
      slug: slug.trim(),
    });

    if (error) {
      setErrorMsg(error.message ?? t("createError"));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className={`w-full max-w-md ${revealClass}`}>
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <BrandLogo size="sm" />
          {branding.showLogoText && (
            <span className="text-base font-semibold text-text-primary">
              {branding.appName}
            </span>
          )}
        </div>

        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-2">
                <Building2 className="w-6 h-6 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                {t("title")}
              </h2>
              <p className="text-sm text-text-muted">{t("subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label={t("orgName")}
                placeholder={t("orgNamePlaceholder")}
                value={orgName}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
              <Input
                label={t("slug")}
                placeholder={t("slugPlaceholder")}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />

              {errorMsg && (
                <p className="text-sm text-error" role="alert">
                  {errorMsg}
                </p>
              )}

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isLoading || !orgName.trim() || !slug.trim()}
              >
                {isLoading ? t("creating") : t("createButton")}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
