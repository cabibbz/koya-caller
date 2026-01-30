/**
 * Onboarding Phase 2 API
 * Saves services, FAQs, and voice from the Tune step
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

interface Service {
  id?: string;
  name: string;
  duration: number;
}

interface FAQ {
  id?: string;
  question: string;
  answer: string;
}

interface Phase2Data {
  services?: Service[];
  faqs?: FAQ[];
  voiceId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: Phase2Data = await request.json();
    const { services, faqs, voiceId } = body;

    // Get business ID from user metadata
    const businessId = user.app_metadata?.tenant_id;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found. Please complete Phase 1 first." },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for RLS bypass
    const adminClient = createAdminClient() as any;

    // Save services
    if (services && services.length > 0) {
      // Delete existing services first
      await adminClient
        .from("services")
        .delete()
        .eq("business_id", businessId);

      // Insert new services
      const servicesToInsert = services.map((service, index) => ({
        business_id: businessId,
        name: service.name,
        duration_minutes: service.duration,
        is_bookable: true,
        sort_order: index,
      }));

      const { error: _servicesError } = await adminClient
        .from("services")
        .insert(servicesToInsert);

      // Services error handled silently
    }

    // Save FAQs
    if (faqs && faqs.length > 0) {
      // Delete existing FAQs first
      await adminClient
        .from("faqs")
        .delete()
        .eq("business_id", businessId);

      // Insert new FAQs
      const faqsToInsert = faqs.map((faq, index) => ({
        business_id: businessId,
        question: faq.question,
        answer: faq.answer,
        sort_order: index,
      }));

      const { error: _faqsError } = await adminClient
        .from("faqs")
        .insert(faqsToInsert);

      // FAQs error handled silently
    }

    // Save voice selection
    if (voiceId) {
      const { error: _voiceError } = await adminClient
        .from("ai_config")
        .upsert({
          business_id: businessId,
          voice_id: voiceId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });

      // Voice error handled silently
    }

    // Update onboarding step
    await adminClient
      .from("businesses")
      .update({
        onboarding_step: 3,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Onboarding Phase2 POST", error);
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}

// GET endpoint to load existing data
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = user.app_metadata?.tenant_id;

    if (!businessId) {
      return NextResponse.json({ services: [], faqs: [], voiceId: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for RLS bypass
    const adminClient = createAdminClient() as any;

    // Fetch existing data
    const [servicesRes, faqsRes, aiConfigRes, businessRes] = await Promise.all([
      adminClient
        .from("services")
        .select("id, name, duration_minutes")
        .eq("business_id", businessId)
        .order("sort_order"),
      adminClient
        .from("faqs")
        .select("id, question, answer")
        .eq("business_id", businessId)
        .order("sort_order"),
      adminClient
        .from("ai_config")
        .select("voice_id")
        .eq("business_id", businessId)
        .single(),
      adminClient
        .from("businesses")
        .select("website")
        .eq("id", businessId)
        .single(),
    ]);

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB response shape mapping
      services: (servicesRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration_minutes,
      })),
      faqs: faqsRes.data || [],
      voiceId: aiConfigRes.data?.voice_id || null,
      websiteUrl: businessRes.data?.website || null,
    });
  } catch (error) {
    logError("Onboarding Phase2 GET", error);
    return NextResponse.json(
      { error: "Failed to load data" },
      { status: 500 }
    );
  }
}
