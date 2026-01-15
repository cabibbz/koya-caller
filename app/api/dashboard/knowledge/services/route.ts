/**
 * Services Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 722-727
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
    const { services } = body;

    if (!Array.isArray(services)) {
      return NextResponse.json({ error: "Services must be an array" }, { status: 400 });
    }

    // Delete existing services
    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to update services" }, { status: 500 });
    }

    // Insert new services
    if (services.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Request body type from client
      const servicesToInsert = services.map((s: any, index: number) => ({
        business_id: businessId,
        name: s.name,
        description: s.description || null,
        duration_minutes: s.duration_minutes || 60,
        price_cents: s.price_cents || null,
        price_type: s.price_type || "quote",
        is_bookable: s.is_bookable ?? true,
        sort_order: index,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { error: insertError } = await (supabase as any)
        .from("services")
        .insert(servicesToInsert);

      if (insertError) {
        return NextResponse.json({ error: "Failed to save services" }, { status: 500 });
      }
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId,
        triggeredBy: "services_update",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Knowledge Services PUT", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
