"use client";

/**
 * Dashboard Header
 * Session 16: Dashboard - Home & Calls
 * Top bar with user menu (sidebar handles main navigation)
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { signOut } from "@/lib/auth/actions";
import { LogOut, User } from "lucide-react";

export function DashboardHeader() {
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
        {/* Spacer for mobile menu button */}
        <div className="w-10 lg:w-0" />

        {/* Right side - User menu */}
        <div className="flex items-center gap-4">
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
              {signingOut ? "Signing out..." : "Sign out"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
