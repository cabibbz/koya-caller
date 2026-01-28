/**
 * Reset Password Form Component
 * Used after clicking the password reset link in email
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
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

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsDontMatch"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await updatePassword(formData.password);

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

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthLabelKeys = ["veryWeak", "weak", "fair", "good", "strong", "veryStrong"];
  const strengthColors = [
    "bg-error",
    "bg-error",
    "bg-warning",
    "bg-warning",
    "bg-success",
    "bg-success",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-center">
        <h2 className="text-xl font-semibold">{t("setNewPassword")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("setNewPasswordDesc")}
        </p>
      </div>

      {/* New Password */}
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
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

        {/* Password strength indicator */}
        {formData.password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < passwordStrength
                      ? strengthColors[passwordStrength - 1]
                      : "bg-border"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("passwordStrength")} {t(strengthLabelKeys[Math.max(0, passwordStrength - 1)])}
            </p>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder={t("confirmPasswordPlaceholder")}
            value={formData.confirmPassword}
            onChange={handleChange}
            className="pl-10 pr-10"
            required
            minLength={8}
            disabled={isLoading}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Passwords match indicator */}
        {formData.confirmPassword && (
          <div className="flex items-center gap-1 text-xs">
            {formData.password === formData.confirmPassword ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span className="text-success">{t("passwordsMatch")}</span>
              </>
            ) : (
              <span className="text-error">{t("passwordsDontMatch")}</span>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("updatingPassword")}
          </>
        ) : (
          t("resetPassword")
        )}
      </Button>
    </form>
  );
}
