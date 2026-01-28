/**
 * Signup Form Component
 * 
 * Spec Reference: Part 4, Lines 172-176
 * Account Creation fields:
 * - Email
 * - Password
 * - Business name
 * - Your phone number (for transfers & SMS alerts)
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup, type SignupData } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Mail, Lock, Building2, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

export function SignupForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<SignupData>({
    email: "",
    password: "",
    businessName: "",
    phone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signup(formData);

      if (!result.success) {
        setError(result.error || tErrors("generic"));
        return;
      }

      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
    } catch (_err) {
      // Error handled silently
      setError(tErrors("generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
            value={formData.email}
            onChange={handleChange}
            className="pl-10"
            required
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("newPasswordPlaceholder")}
            value={formData.password}
            onChange={handleChange}
            className="pl-10 pr-10"
            required
            minLength={8}
            disabled={isLoading}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="businessName">{t("businessName")}</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="businessName"
            name="businessName"
            type="text"
            placeholder={t("businessNamePlaceholder")}
            value={formData.businessName}
            onChange={handleChange}
            className="pl-10"
            required
            disabled={isLoading}
            autoComplete="organization"
          />
        </div>
      </div>

      {/* Phone Number */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t("yourPhoneNumber")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("phoneNumberHint")}
        </p>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={t("phonePlaceholder")}
            value={formData.phone}
            onChange={handleChange}
            className="pl-10"
            required
            disabled={isLoading}
            autoComplete="tel"
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("creatingAccount")}
          </>
        ) : (
          t("createAccount")
        )}
      </Button>

      {/* Links */}
      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("login")}
        </Link>
      </p>

      {/* Terms */}
      <p className="text-center text-xs text-muted-foreground">
        {t("termsText")}{" "}
        <Link href="/terms" className="text-primary hover:underline">
          {t("termsOfService")}
        </Link>{" "}
        {t("and")}{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          {t("privacyPolicy")}
        </Link>
        .
      </p>
    </form>
  );
}
