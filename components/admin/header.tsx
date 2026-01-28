"use client";

/**
 * Admin Dashboard Header
 * Part 8: Admin Dashboard
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { signOut } from "@/lib/auth/actions";
import { LogOut, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminHeader() {
  const t = useTranslations("admin");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    if (result.success) {
      router.push("/login");
    }
    setSigningOut(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Admin indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1">
            <Shield className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-red-500">{t("adminMode")}</span>
          </div>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center gap-4">
          {!isLoading && user && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {signingOut ? t("signingOut") : t("signOut")}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
