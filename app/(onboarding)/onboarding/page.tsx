/**
 * New Experimental Onboarding - Phase 1: Tell
 * Conversational chat-style onboarding
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingPhase1 } from "./phase-1-client";

export const dynamic = "force-dynamic";

export default async function NewOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch business templates for selection
  const { data: templates } = await supabase
    .from("business_templates")
    .select("type_slug, type_name")
    .order("type_name");

  return (
    <OnboardingPhase1
      businessTypes={templates || []}
      userId={user.id}
    />
  );
}
