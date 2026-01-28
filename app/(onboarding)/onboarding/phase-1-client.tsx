"use client";

/**
 * Phase 1 Client Component - Tell
 * Handles the conversational onboarding flow
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import {
  OnboardingLayout,
  ConversationFlow,
} from "@/components/onboarding-v2";

interface OnboardingPhase1Props {
  businessTypes: { type_slug: string; type_name: string }[];
  userId: string;
}

export function OnboardingPhase1({ businessTypes, userId: _userId }: OnboardingPhase1Props) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Your Business");
  const [greeting, setGreeting] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleComplete = async (data: {
    businessType: string;
    businessTypeName: string;
    businessName?: string;
    phoneNumber?: string;
    websiteUrl?: string;
    businessHours?: { type: string; customHours?: any[] };
    calendarProvider?: string;
    greeting?: string;
  }) => {
    // Update state for preview
    if (data.businessName) {
      setBusinessName(data.businessName);
      setGreeting(data.greeting || `Hi, thanks for calling ${data.businessName}. This is Koya, how can I help you today?`);
    }

    setIsSaving(true);

    // Save to database
    try {
      const response = await fetch("/api/onboarding/phase1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: data.businessType,
          businessTypeName: data.businessTypeName,
          businessName: data.businessName,
          phoneNumber: data.phoneNumber,
          websiteUrl: data.websiteUrl,
          businessHours: data.businessHours,
          calendarProvider: data.calendarProvider,
          greeting: data.greeting,
        }),
      });

      if (response.ok) {
        // Navigate to phase 2
        router.push("/onboarding/tune");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({ title: "Error", description: errorData.error || "Failed to save your information. Please try again.", variant: "destructive" });
        setIsSaving(false);
      }
    } catch (_error) {
      toast({ title: "Connection Error", description: "Please check your internet and try again.", variant: "destructive" });
      setIsSaving(false);
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
