/**
 * Settings Page - Server Component
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 748-810
 *
 * Fetches all settings data and passes to client component
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings",
  description: "Configure your Koya AI receptionist settings, voice, and integrations.",
};
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Get authenticated user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Get user's business
  const business = await getBusinessByUserId(user.id);
  if (!business) {
    redirect("/onboarding");
  }

  // Fetch all settings data in parallel
  const [
    { data: callSettings },
    { data: aiConfig },
    { data: calendarIntegration },
    { data: notificationSettings },
    { data: phoneNumbers },
  ] = await Promise.all([
    supabase
      .from("call_settings")
      .select("*")
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("ai_config")
      .select("*")
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("calendar_integrations")
      .select("*")
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("notification_settings")
      .select("*")
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("phone_numbers")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true),
  ]);

  // Get plan info
  let planName = "Starter";
  if (business.plan_id) {
    const { data: planData } = await supabase
      .from("plans")
      .select("name")
      .eq("id", business.plan_id)
      .single();
    // Cast to expected shape since plans table is public
    const plan = planData as { name: string } | null;
    if (plan?.name) planName = plan.name;
  }

  // Extract prompt_config from aiConfig if available
  // Note: prompt_config column added by migration 20250110000001
  const promptConfig = (aiConfig as Record<string, unknown> | null)?.prompt_config as {
    industryEnhancements?: boolean;
    fewShotExamplesEnabled?: boolean;
    sentimentDetectionLevel?: "none" | "basic" | "advanced";
    callerContextEnabled?: boolean;
    toneIntensity?: 1 | 2 | 3 | 4 | 5;
    personalityAwareErrors?: boolean;
    maxFewShotExamples?: number;
  } | null;

  return (
    <div className="p-6 lg:p-8">
      <SettingsClient
        businessId={business.id}
        businessInfo={{
          name: business.name,
          planName,
          subscriptionStatus: business.subscription_status,
          minutesUsed: business.minutes_used_this_cycle,
          minutesIncluded: business.minutes_included,
          cycleStart: business.current_cycle_start,
          cycleEnd: business.current_cycle_end,
          stripeCustomerId: business.stripe_customer_id,
          userEmail: user.email || "",
          slug: (business as any).slug || null,
        }}
        initialCallSettings={callSettings}
        initialAiConfig={aiConfig}
        initialCalendarIntegration={calendarIntegration}
        initialNotificationSettings={notificationSettings}
        initialPhoneNumbers={phoneNumbers || []}
        initialPromptConfig={promptConfig}
      />
    </div>
  );
}
