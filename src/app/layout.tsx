import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { branding } from "@/config/branding";
import { SplashScreen } from "@/components/SplashScreen";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { satoshi, cabinetGrotesk } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: branding.appName,
  description: branding.subtitle,
};

/** Root layout with theme provider, i18n, and toast context. */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${satoshi.variable} ${cabinetGrotesk.variable}`}
    >
      <head>
        {/* Block FOUC: apply data-theme before first paint. `next/script`
            beforeInteractive injects it into the initial HTML (and avoids the
            "script tag inside a React component" dev warning). */}
        <Script id="theme-no-flash" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("studioblack-theme-v2")==="dark"){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}`}
        </Script>
        {/* Fonts (Satoshi body + Cabinet Grotesk headings) are self-hosted via
            `next/font/local` — see ./fonts.ts. No render-blocking request. */}
      </head>
      <body className="antialiased">
        <SplashScreen />
        <NextIntlClientProvider messages={messages}>
          <PostHogProvider>
            <ThemeProvider>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
              <Toaster />
            </ThemeProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
