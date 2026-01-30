"use client";

/**
 * Onboarding Banner
 * Shows when user hasn't completed onboarding
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, X } from "lucide-react";
import { useState } from "react";

interface OnboardingBannerProps {
  businessName?: string;
}

export function OnboardingBanner({ businessName }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 rounded-lg p-4 mb-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">
            Complete your setup{businessName ? `, ${businessName}` : ""}
          </h3>
          <p className="text-sm text-muted-foreground">
            Set up your AI receptionist to start taking calls. It only takes 5 minutes.
          </p>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link href="/onboarding">
            Start Setup
          </Link>
        </Button>
      </div>
    </div>
  );
}
