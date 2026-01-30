/**
 * Campaigns Page
 * List all email and outbound calling campaigns
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { redirect } from "next/navigation";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Manage email and outbound calling campaigns",
};

export const dynamic = "force-dynamic";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

async function CampaignsContent() {
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

  // Fetch initial campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*", { count: "exact" })
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <CampaignList
      initialCampaigns={campaigns || []}
      initialTotal={campaigns?.length || 0}
    />
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CampaignsContent />
    </Suspense>
  );
}
