import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { CookieConsent } from "@/components/cookie-consent";
import { OrganizationJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";
import { SkipNavLink } from "@/components/skip-nav";
import { PageProgress } from "@/components/page-progress";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { APP_CONFIG, getProductionUrl } from "@/lib/config";
import "./globals.css";

/**
 * Koya Caller - Root Layout
 * Spec Part 21, Lines 2257-2272: Typography
 * Using Geist Sans for all text (Vercel's typeface)
 */

export const metadata: Metadata = {
  title: {
    default: "Koya Caller - AI Receptionist for Local Businesses",
    template: "%s | Koya Caller",
  },
  description:
    "Never miss another call. Koya answers your phone 24/7, books appointments, and handles customer questions - so you don't have to.",
  keywords: [
    "AI receptionist",
    "virtual receptionist",
    "business phone",
    "appointment booking",
    "local business",
    "24/7 answering",
  ],
  authors: [{ name: "Koya Caller" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koya Caller",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getProductionUrl(),
    siteName: APP_CONFIG.fullName,
    title: "Koya Caller - AI Receptionist for Local Businesses",
    description:
      "Never miss another call. Koya answers your phone 24/7, books appointments, and handles customer questions.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Koya Caller - AI Receptionist for Local Businesses",
    description:
      "Never miss another call. Koya answers your phone 24/7, books appointments, and handles customer questions.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#3B82F6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <PageProgress />
            <SkipNavLink />
            {children}
            <Toaster />
            <CookieConsent />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
