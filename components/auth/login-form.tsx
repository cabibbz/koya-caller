/**
 * Login Form Component
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Security: Validate redirect URL to prevent open redirect attacks
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirectTo = (() => {
    // Only allow relative paths starting with /
    if (!rawRedirect.startsWith("/")) return "/dashboard";
    // Block protocol-relative URLs (//evil.com)
    if (rawRedirect.startsWith("//")) return "/dashboard";
    // Block javascript: and data: URLs
    if (/^\/[a-z]+:/i.test(rawRedirect)) return "/dashboard";
    return rawRedirect;
  })();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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
      const result = await login(formData);

      if (!result.success) {
        setError(result.error || tErrors("generic"));
        return;
      }

      // Use the redirectTo from result if provided, otherwise use URL param
      const destination = result.redirectTo || redirectTo;
      router.push(destination);
      router.refresh();
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("password")}</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("passwordPlaceholder")}
            value={formData.password}
            onChange={handleChange}
            className="pl-10 pr-10"
            required
            disabled={isLoading}
            autoComplete="current-password"
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

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("loggingIn")}
          </>
        ) : (
          t("logIn")
        )}
      </Button>

      {/* Sign up link */}
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-primary hover:underline">
          {t("signup")}
        </Link>
      </p>
    </form>
  );
}
