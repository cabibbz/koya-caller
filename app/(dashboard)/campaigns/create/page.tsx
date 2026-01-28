/**
 * Create Campaign Page
 * Wizard for creating new outbound campaigns
 */

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { redirect } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";

export const metadata: Metadata = {
  title: "Create Campaign",
  description: "Create a new outbound calling campaign",
};

export const dynamic = "force-dynamic";

export default async function CreateCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const business = await getBusinessByUserId(user.id);
  if (!business) {
    redirect("/onboarding");
  }

  return <CampaignWizard />;
}
