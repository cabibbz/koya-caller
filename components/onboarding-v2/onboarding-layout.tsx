"use client";

/**
 * New Onboarding Layout
 * Split-screen with conversation on left, preview on right
 */

import { motion } from "framer-motion";
import { ProgressPath, OnboardingPhase } from "./progress-path";
import { PhonePreview } from "./phone-preview";
import { KoyaAvatar } from "./koya-avatar";

interface OnboardingLayoutProps {
  phase: OnboardingPhase;
  businessName?: string;
  greeting?: string;
  children: React.ReactNode;
  showPhonePreview?: boolean;
}

export function OnboardingLayout({
  phase,
  businessName = "Your Business",
  greeting,
  children,
  showPhonePreview = true,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar at top */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <ProgressPath currentPhase={phase} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left side - Conversation */}
          <div className="lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <KoyaAvatar size="sm" state="idle" />
                <div>
                  <p className="font-medium text-sm">Chat with Koya</p>
                  <p className="text-xs text-muted-foreground">Setting up your AI receptionist</p>
                </div>
              </div>

              {/* Conversation content */}
              <div className="h-[500px] overflow-y-auto">
                {children}
              </div>
            </motion.div>
          </div>

          {/* Right side - Phone Preview (hidden on mobile) */}
          {showPhonePreview && (
            <div className="hidden lg:block">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="sticky top-24"
              >
                <div className="text-center mb-4">
                  <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
                  <p className="text-xs text-muted-foreground">See how Koya will answer</p>
                </div>
                <PhonePreview
                  businessName={businessName}
                  greeting={greeting}
                  className="mx-auto max-w-[280px]"
                />
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Phase 2: Tune - Review and customize
export function TuneLayout({
  children,
  businessName,
  greeting,
}: {
  children: React.ReactNode;
  businessName: string;
  greeting?: string;
}) {
  return (
    <OnboardingLayout
      phase={2}
      businessName={businessName}
      greeting={greeting}
      showPhonePreview
    >
      {children}
    </OnboardingLayout>
  );
}

// Phase 3: Test - Final setup
export function TestLayout({
  children,
  businessName,
}: {
  children: React.ReactNode;
  businessName: string;
}) {
  return (
    <OnboardingLayout
      phase={3}
      businessName={businessName}
      showPhonePreview={false}
    >
      {children}
    </OnboardingLayout>
  );
}
