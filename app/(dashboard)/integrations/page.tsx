/**
 * Integrations Page
 * Connect third-party services to enhance Koya's capabilities
 *
 * Supported integrations:
 * - E-Commerce: Shopify, Square (inventory, orders)
 * - Payments: Stripe Connect (payment collection)
 * - CRM: HubSpot, Salesforce (lead management)
 * - Industry: OpenTable, Mindbody (reservations)
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntegrationsClient } from "./integrations-client";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect third-party services to enhance your AI receptionist",
};

export default async function IntegrationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get business
  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (businessError || !businessData) {
    redirect("/onboarding");
  }

  const business = businessData as { id: string; name: string };

  // Get existing integrations
  const { data: integrations } = await supabase
    .from("business_integrations")
    .select("*")
    .eq("business_id", business.id);

  return (
    <IntegrationsClient
      businessId={business.id}
      initialIntegrations={(integrations || []) as Array<{
        id: string;
        provider: string;
        is_active: boolean;
        shop_domain?: string;
        location_id?: string;
        account_id?: string;
        created_at: string;
      }>}
    />
  );
}
