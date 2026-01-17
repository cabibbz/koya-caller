/**
 * Koya's Knowledge Page
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 718-746
 *
 * Important: Any changes here trigger automatic prompt regeneration
 * and Retell agent update (Line 720)
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description: "Manage what your Koya AI receptionist knows about your business.",
};
import { createClient } from "@/lib/supabase/server";
import { KnowledgeClient } from "./knowledge-client";

export default async function KnowledgePage() {
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
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (businessError || !businessData) {
    redirect("/onboarding");
  }

  // Type assertion after redirect check
  const business = businessData as {
    id: string;
    name: string;
    address: string | null;
    website: string | null;
    service_area: string | null;
    differentiator: string | null;
  };

  // Get services
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("sort_order");

  // Get FAQs
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("business_id", business.id)
    .order("sort_order");

  // Get knowledge (freeform notes)
  const { data: knowledge } = await supabase
    .from("knowledge")
    .select("*")
    .eq("business_id", business.id)
    .single();

  // Get business hours
  const { data: businessHours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("business_id", business.id)
    .order("day_of_week");

  // Get AI config for language info and offer settings
  const { data: aiConfig } = await supabase
    .from("ai_config")
    .select("spanish_enabled, system_prompt_generated_at, upsells_enabled, bundles_enabled, packages_enabled, memberships_enabled")
    .eq("business_id", business.id)
    .single();

  // Type assertions needed for Supabase RLS type inference limitations
  // The client component expects specific prop shapes that don't match inferred DB types
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (
    <KnowledgeClient
      businessId={business.id}
      initialBusiness={{
        name: business.name,
        address: business.address,
        website: business.website,
        service_area: business.service_area,
        differentiator: business.differentiator,
      }}
      initialServices={(services || []) as any[]}
      initialFaqs={(faqs || []) as any[]}
      initialKnowledge={knowledge ? { content: (knowledge as any).content || null, never_say: (knowledge as any).never_say || null } : { content: "", never_say: "" }}
      initialBusinessHours={(businessHours || []) as any[]}
      spanishEnabled={((aiConfig as any)?.spanish_enabled as boolean) || false}
      lastPromptGenerated={((aiConfig as any)?.system_prompt_generated_at as string) || null}
      initialOfferSettings={{
        upsellsEnabled: ((aiConfig as any)?.upsells_enabled as boolean) ?? true,
        bundlesEnabled: ((aiConfig as any)?.bundles_enabled as boolean) ?? true,
        packagesEnabled: ((aiConfig as any)?.packages_enabled as boolean) ?? true,
        membershipsEnabled: ((aiConfig as any)?.memberships_enabled as boolean) ?? true,
      }}
    />
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
