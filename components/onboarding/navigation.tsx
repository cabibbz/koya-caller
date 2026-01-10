"use client";

/**
 * Onboarding Navigation Buttons
 * Spec Reference: Part 5, Lines 213-214
 * - "Back" and "Next" buttons on each step
 * - "Save & Exit" option (resume later)
 */

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/context";
import { ONBOARDING_STEPS } from "@/types/onboarding";

interface OnboardingNavigationProps {
  onNext?: () => Promise<void> | void;
  onBack?: () => void;
  onSaveAndExit?: () => Promise<void> | void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  showSaveAndExit?: boolean;
  isSubmitting?: boolean;
}

export function OnboardingNavigation({
  onNext,
  onBack,
  onSaveAndExit,
  nextLabel = "Next",
  nextDisabled = false,
  showBack = true,
  showSaveAndExit = true,
  isSubmitting = false,
}: OnboardingNavigationProps) {
  const router = useRouter();
  const { state, goBack } = useOnboarding();

  const isFirstStep = state.currentStep === 1;
  const isLastStep = state.currentStep === ONBOARDING_STEPS.length;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };

  const handleSaveAndExit = async () => {
    if (onSaveAndExit) {
      await onSaveAndExit();
    }
    // Navigate to dashboard or home
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      {/* Back Button */}
      <div className="order-2 sm:order-1">
        {showBack && !isFirstStep && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={isSubmitting}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>

      {/* Next and Save & Exit */}
      <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:items-center">
        {showSaveAndExit && (
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveAndExit}
            disabled={isSubmitting}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save & Exit
          </Button>
        )}

        <Button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              {nextLabel}
              {!isLastStep && <ArrowRight className="h-4 w-4" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Step Header Component
 * Shows step title and optional description
 */
interface StepHeaderProps {
  title: string;
  description?: string;
  badge?: string;
}

export function StepHeader({ title, description, badge }: StepHeaderProps) {
  return (
    <div className="mb-8">
      {badge && (
        <span className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {badge}
        </span>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
