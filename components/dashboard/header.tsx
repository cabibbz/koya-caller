"use client";

/**
 * Dashboard Header
 * Session 16: Dashboard - Home & Calls
 * Top bar with user menu (sidebar handles main navigation)
 */

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/use-auth";
import { signOut } from "@/lib/auth/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { HelpPanel } from "@/components/dashboard/help-panel";
import { CommandPaletteTrigger } from "@/components/command-palette";
import { LogOut, User, HelpCircle, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DashboardHeader() {
  const t = useTranslations("auth");
  const tHelp = useTranslations("help");
  const tDashboard = useTranslations("dashboard");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mockMode, setMockMode] = useState<{
    active: boolean;
    criticalMissing: string[];
  } | null>(null);

  // Fetch mock mode status
  useEffect(() => {
    fetch("/api/dashboard/integrations/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && !data.data.allConfigured) {
          setMockMode({
            active: true,
            criticalMissing: data.data.criticalMissing || [],
          });
        }
      })
      .catch(() => {
        // Silently fail
      });
  }, []);

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
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:w-0" />

        {/* Mock Mode Badge - Always visible when in mock mode */}
        {mockMode?.active && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold animate-pulse cursor-help"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tDashboard("mockModeLabel")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{tDashboard("criticalRequired")}</p>
                <ul className="mt-1 text-xs">
                  {mockMode.criticalMissing.map((name) => (
                    <li key={name}>• {name}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Right side - User menu */}
        <div className="flex items-center gap-4">
          {/* Global Search Trigger */}
          <CommandPaletteTrigger />
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            className="h-9 w-9"
            aria-label={tHelp("panelTitle")}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          {!isLoading && user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user.email}</span>
            </div>
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

      {/* Help Panel */}
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}
