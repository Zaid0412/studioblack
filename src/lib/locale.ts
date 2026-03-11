"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/i18n/request";

/**
 * Server action — persists the chosen locale in a cookie and triggers
 * a full page reload so next-intl picks up the new language.
 */
export async function setLocale(locale: string) {
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
}
