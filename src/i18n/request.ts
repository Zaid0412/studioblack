import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/** All supported locale codes. */
export const SUPPORTED_LOCALES = ["en", "tr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Cookie key used to persist the user's language preference. */
export const LOCALE_COOKIE = "studioblack-locale";

const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * next-intl request configuration.
 *
 * Reads the locale from the `studioblack-locale` cookie (set by the
 * language switcher on the settings page). Falls back to English.
 */
export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  const locale: SupportedLocale =
    raw && SUPPORTED_LOCALES.includes(raw as SupportedLocale)
      ? (raw as SupportedLocale)
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
