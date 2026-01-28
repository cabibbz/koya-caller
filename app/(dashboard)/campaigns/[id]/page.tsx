/**
 * Campaign Detail Page
 * View and manage a specific campaign
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { redirect, notFound } from "next/navigation";
import { CampaignDetail } from "./campaign-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Campaign Details",
  description: "View campaign details and progress",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

async function CampaignContent({ campaignId }: { campaignId: string }) {
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

  // Fetch campaign
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (error || !campaign) {
    notFound();
  }

  return <CampaignDetail campaign={campaign} />;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CampaignContent campaignId={id} />
    </Suspense>
  );
}
