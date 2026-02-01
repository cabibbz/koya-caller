/**
 * Edit Campaign Page
 * Edit an existing campaign
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { redirect, notFound } from "next/navigation";
import { CampaignEditForm } from "./campaign-edit-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Edit Campaign",
  description: "Edit campaign settings",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[600px]" />
    </div>
  );
}

async function EditCampaignContent({ campaignId }: { campaignId: string }) {
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

  // Fetch campaign - use type assertion since campaigns table may not be in types
  const { data: campaign, error } = await (supabase as any)
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (error || !campaign) {
    notFound();
  }

  // Cannot edit active or completed campaigns
  const campaignStatus = (campaign as any).status;
  if (campaignStatus === "active" || campaignStatus === "completed") {
    redirect(`/campaigns/${campaignId}`);
  }

  // Fetch contacts for the business
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("business_id", business.id)
    .limit(200);

  // Fetch campaign contacts (if stored separately)
  const { data: campaignContacts } = await (supabase as any)
    .from("campaign_contacts")
    .select("contact_id")
    .eq("campaign_id", campaignId);

  const selectedContactIds = (campaignContacts || []).map((cc: any) => cc.contact_id);

  return (
    <CampaignEditForm
      campaign={campaign}
      contacts={contacts || []}
      selectedContactIds={selectedContactIds}
    />
  );
}

export default async function EditCampaignPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <EditCampaignContent campaignId={id} />
    </Suspense>
  );
}
