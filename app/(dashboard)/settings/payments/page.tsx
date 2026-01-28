/**
 * Payment Settings Page
 * Task P3-15: Payment Management Dashboard
 *
 * Features:
 * - Stripe Connect onboarding and status
 * - Account verification status
 * - Payout settings configuration
 * - Payment history table
 * - Revenue overview with summaries
 * - Fee breakdown display
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { PaymentDashboard } from "./payment-dashboard";

export const metadata: Metadata = {
  title: "Payments | Settings",
  description: "Manage your payment settings, Stripe Connect, and view payment history.",
};

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground">
          Manage your Stripe Connect account, deposits, and view payment history.
        </p>
      </div>
      <PaymentDashboard businessId={business.id} userEmail={user.email || ""} />
    </div>
  );
}
