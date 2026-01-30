/**
 * Forgot Password Form Component
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(email);

      if (!result.success) {
        setError(result.error || tErrors("generic"));
        return;
      }

      setSuccess(true);
    } catch (_err) {
      // Error handled silently
      setError(tErrors("generic"));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="rounded-full bg-success/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold">{t("checkYourEmail")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("resetEmailSent", { email })}
          </p>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSuccess(false);
              setEmail("");
            }}
          >
            {t("tryAnotherEmail")}
          </Button>

          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToLogin")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-center">
        <h2 className="text-xl font-semibold">{t("forgotPasswordTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("forgotPasswordDesc")}
        </p>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className="pl-10"
            required
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("sending")}
          </>
        ) : (
          t("sendResetLink")
        )}
      </Button>

      {/* Back to login */}
      <Link href="/login" className="block">
        <Button variant="ghost" className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToLogin")}
        </Button>
      </Link>
    </form>
  );
}
