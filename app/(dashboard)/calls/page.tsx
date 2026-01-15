/**
 * Calls List Page
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 678-699
 */

import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Call History",
  description: "View and manage all calls handled by your Koya AI receptionist.",
};
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getCallsByBusinessId } from "@/lib/db/calls";
import { redirect } from "next/navigation";
import { CallsListClient } from "./calls-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallOutcome, CallLanguage } from "@/types";

// Prevent static prerendering - requires auth
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    outcome?: string;
    language?: string;
    search?: string;
    page?: string;
    id?: string;
  }>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

async function CallsContent({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const params = await searchParams;
  
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Get user's business
  const business = await getBusinessByUserId(user.id);
  if (!business) {
    redirect("/onboarding");
  }

  // Parse filters from search params
  const page = parseInt(params.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const filters = {
    startDate: params.startDate,
    endDate: params.endDate,
    outcome: params.outcome as CallOutcome | undefined,
    language: params.language as CallLanguage | undefined,
    searchQuery: params.search,
    limit,
    offset,
  };

  // Fetch calls
  const { calls, total } = await getCallsByBusinessId(business.id, filters);

  return (
    <CallsListClient
      initialCalls={calls}
      total={total}
      page={page}
      limit={limit}
      filters={{
        startDate: params.startDate,
        endDate: params.endDate,
        outcome: params.outcome,
        language: params.language,
        search: params.search,
      }}
      selectedCallId={params.id}
    />
  );
}

export default function CallsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CallsContent searchParams={searchParams} />
    </Suspense>
  );
}
