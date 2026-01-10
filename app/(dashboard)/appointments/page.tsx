/**
 * Appointments Page
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 700-717
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Appointments",
  description: "Manage appointments booked through your Koya AI receptionist.",
};
import { createClient } from "@/lib/supabase/server";
import { AppointmentsClient } from "./appointments-client";

export default async function AppointmentsPage() {
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
    .select("id, name, timezone")
    .eq("user_id", user.id)
    .single();

  if (businessError || !businessData) {
    redirect("/onboarding");
  }

  // Type assertion after redirect check
  const business = businessData as { id: string; name: string; timezone: string | null };

  // Get services for the service dropdown
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("business_id", business.id)
    .eq("is_bookable", true)
    .order("sort_order");

  return (
    <AppointmentsClient 
      businessId={business.id} 
      timezone={business.timezone || "America/New_York"}
      services={(services || []) as { id: string; name: string; duration_minutes: number }[]}
    />
  );
}
