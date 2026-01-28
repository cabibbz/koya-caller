/**
 * Public Booking Page
 * /book/[slug] - Publicly accessible booking page for a business
 */

import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingPage } from "@/components/scheduler/booking-page";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("name")
    .eq("slug", slug)
    .single();

  if (!business) {
    return { title: "Book an Appointment" };
  }

  return {
    title: `Book with ${business.name}`,
    description: `Schedule an appointment with ${business.name}`,
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { slug } = await params;

  // Verify business exists server-side
  const supabase = createAdminClient();
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id, slug")
    .eq("slug", slug)
    .single();

  if (!business) {
    notFound();
  }

  return <BookingPage slug={slug} />;
}
