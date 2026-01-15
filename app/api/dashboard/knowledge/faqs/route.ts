/**
 * FAQs Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 729-733
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";
import { logError } from "@/lib/logging";

export async function PUT(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(request.headers);
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = (business as { id: string }).id;
    const body = await request.json();
    const { faqs } = body;

    if (!Array.isArray(faqs)) {
      return NextResponse.json({ error: "FAQs must be an array" }, { status: 400 });
    }

    // Delete existing FAQs
    const { error: deleteError } = await supabase
      .from("faqs")
      .delete()
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to update FAQs" }, { status: 500 });
    }

    // Insert new FAQs
    if (faqs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Request body type from client
      const faqsToInsert = faqs.map((f: any, index: number) => ({
        business_id: businessId,
        question: f.question,
        answer: f.answer,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { error: insertError } = await (supabase as any)
        .from("faqs")
        .insert(faqsToInsert);

      if (insertError) {
        return NextResponse.json({ error: "Failed to save FAQs" }, { status: 500 });
      }
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId,
        triggeredBy: "faqs_update",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Knowledge FAQs PUT", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
