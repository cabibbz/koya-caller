"use client";

/**
 * Phase 1 Client Component - Tell
 * Handles the conversational onboarding flow
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  OnboardingLayout,
  ConversationFlow,
} from "@/components/onboarding-v2";

interface OnboardingPhase1Props {
  businessTypes: { type_slug: string; type_name: string }[];
  userId: string;
}

export function OnboardingPhase1({ businessTypes, userId }: OnboardingPhase1Props) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Your Business");
  const [greeting, setGreeting] = useState<string | undefined>();

  const handleComplete = async (data: {
    businessType: string;
    businessTypeName: string;
    businessName?: string;
  }) => {
    // Update state for preview
    if (data.businessName) {
      setBusinessName(data.businessName);
      setGreeting(`Hi, thanks for calling ${data.businessName}. This is Koya, how can I help you today?`);
    }

    // Save to database
    try {
      const response = await fetch("/api/onboarding/phase1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: data.businessType,
          businessTypeName: data.businessTypeName,
          businessName: data.businessName,
        }),
      });

      if (response.ok) {
        // Navigate to phase 2
        router.push("/onboarding/tune");
      }
    } catch (error) {
      // Failed to save handled silently
    }
  };

  return (
    <OnboardingLayout
      phase={1}
      businessName={businessName}
      greeting={greeting}
    >
      <ConversationFlow
        businessTypes={businessTypes}
        onComplete={handleComplete}
      />
    </OnboardingLayout>
  );
}
