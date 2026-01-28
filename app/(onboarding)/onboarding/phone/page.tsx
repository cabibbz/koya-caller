/**
 * Phase 2.5: Phone Setup
 * Select or provision a phone number for receiving calls
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneSetupClient } from "./phone-client";

export default async function PhoneSetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const tenantId = user.app_metadata?.tenant_id;

  if (!tenantId) {
    redirect("/onboarding");
  }

  // Check if user already has an active phone number
  const { data: existingPhone } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("business_id", tenantId)
    .eq("is_active", true)
    .single();

  return (
    <PhoneSetupClient
      businessId={tenantId}
      existingPhone={existingPhone}
    />
  );
}
