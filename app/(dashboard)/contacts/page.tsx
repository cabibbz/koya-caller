/**
 * Contacts List Page
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 */

import { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getContactsByBusinessId, getContactStats } from "@/lib/db/contacts";
import { redirect } from "next/navigation";
import { ContactsClient } from "./contacts-client";
import { Skeleton } from "@/components/ui/skeleton";
import { logError } from "@/lib/logging";
import type { CallerTier } from "@/types";

export const metadata: Metadata = {
  title: "Contacts",
  description: "View and manage your customer contacts and caller profiles.",
};

// Prevent static prerendering - requires auth
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    search?: string;
    vipOnly?: string;
    tier?: string;
    page?: string;
    id?: string;
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

async function ContactsContent({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const params = searchParams;

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

  // Parse filters from search params
  const page = parseInt(params.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const filters = {
    search: params.search,
    vipOnly: params.vipOnly === "true",
    tier: params.tier as CallerTier | undefined,
    limit,
    offset,
  };

  // Fetch contacts and stats in parallel
  let contactsResult;
  let stats;

  try {
    [contactsResult, stats] = await Promise.all([
      getContactsByBusinessId(business.id, filters),
      getContactStats(business.id),
    ]);
  } catch (error) {
    logError("Contacts DB Error", error);
    // Return empty data on error
    contactsResult = { contacts: [], total: 0 };
    stats = { total: 0, vipCount: 0, newThisMonth: 0, returningCount: 0 };
  }

  return (
    <ContactsClient
      initialContacts={contactsResult.contacts}
      total={contactsResult.total}
      page={page}
      limit={limit}
      filters={{
        search: params.search,
        vipOnly: params.vipOnly === "true",
        tier: params.tier,
      }}
      stats={stats}
      selectedContactId={params.id}
    />
  );
}

export default function ContactsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ContactsContent searchParams={searchParams} />
    </Suspense>
  );
}
