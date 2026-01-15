"use client";

/**
 * Onboarding Progress Indicator
 * Spec Reference: Part 5, Lines 211-212
 * - Progress indicator showing all steps
 * - Users can jump to any completed step
 */

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/context";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/types/onboarding";

// Map step numbers to their routes
const STEP_ROUTES: Record<OnboardingStep, string> = {
  1: "/onboarding",
  2: "/onboarding/services",
  3: "/onboarding/faqs",
  4: "/onboarding/calendar",
  5: "/onboarding/calls",
  6: "/onboarding/language",
  7: "/onboarding/voice",
  8: "/onboarding/phone",
  9: "/onboarding/test",
};

export function ProgressIndicator() {
  const router = useRouter();
  const { state, goToStep, canGoToStep, isStepComplete } = useOnboarding();

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center justify-between">
        {ONBOARDING_STEPS.map((stepInfo, index) => {
          const isActive = state.currentStep === stepInfo.step;
          const isComplete = isStepComplete(stepInfo.step);
          const isClickable = canGoToStep(stepInfo.step);
          const isLast = index === ONBOARDING_STEPS.length - 1;

          return (
            <li
              key={stepInfo.step}
              className={cn("flex items-center", !isLast && "flex-1")}
            >
              <button
                type="button"
                onClick={() => {
                  if (isClickable) {
                    goToStep(stepInfo.step);
                    router.push(STEP_ROUTES[stepInfo.step]);
                  }
                }}
                disabled={!isClickable}
                className={cn(
                  "flex flex-col items-center gap-2 transition-colors",
                  isClickable && !isActive && "cursor-pointer hover:opacity-80",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isComplete && "border-success bg-success text-white",
                    isActive &&
                      !isComplete &&
                      "border-primary bg-primary text-white",
                    !isActive &&
                      !isComplete &&
                      "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    stepInfo.step
                  )}
                </div>

                {/* Step Label - Hidden on mobile, visible on larger screens */}
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    isActive && "text-foreground",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  {stepInfo.label}
                </span>
              </button>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    isComplete ? "bg-success" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Compact Progress Indicator for mobile
 * Shows current step / total steps
 */
export function CompactProgressIndicator() {
  const { state } = useOnboarding();
  const currentStepInfo = ONBOARDING_STEPS.find(
    (s) => s.step === state.currentStep
  );

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">
        Step {state.currentStep}
      </span>
      <span>of {ONBOARDING_STEPS.length}</span>
      {currentStepInfo && (
        <>
          <span>•</span>
          <span>{currentStepInfo.label}</span>
        </>
      )}
    </div>
  );
}
