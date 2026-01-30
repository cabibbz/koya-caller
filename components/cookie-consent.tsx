"use client";

/**
 * Cookie Consent Banner
 * GDPR/CCPA compliant cookie consent
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const COOKIE_CONSENT_KEY = "koya-cookie-consent";

export function CookieConsent() {
  const t = useTranslations("cookies");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    }));
    setShowBanner(false);
  };

  const acceptNecessary = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    }));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg animate-in slide-in-from-bottom-5 duration-300">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {t("bannerText")}{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                {t("learnMore")}
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={acceptNecessary}>
              {t("necessaryOnly")}
            </Button>
            <Button size="sm" onClick={acceptAll}>
              {t("acceptAll")}
            </Button>
          </div>
          <button
            onClick={acceptNecessary}
            className="absolute top-2 right-2 sm:hidden p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
