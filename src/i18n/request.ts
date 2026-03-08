import { getRequestConfig } from "next-intl/server";

/**
 * next-intl request configuration.
 *
 * Resolves the active locale and loads the corresponding message bundle.
 * Currently hardcoded to English — add locale detection here when
 * multi-language support is needed.
 */
export default getRequestConfig(async () => {
  const locale = "en";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
