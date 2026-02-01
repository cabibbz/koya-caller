/**
 * Login Page Client Component
 * Handles client-side logic and translations
 */

"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth";
import { useTranslations } from "next-intl";

export function LoginPageClient() {
  const t = useTranslations("auth");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("welcomeBack")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("loginSubtitle")}
        </p>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
