/**
 * Signup Page Client Component
 * Handles client-side logic and translations
 */

"use client";

import { SignupForm } from "@/components/auth";
import { useTranslations } from "next-intl";

export function SignupPageClient() {
  const t = useTranslations("auth");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("createYourAccount")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("signupSubtitle")}
        </p>
      </div>

      <SignupForm />
    </div>
  );
}
