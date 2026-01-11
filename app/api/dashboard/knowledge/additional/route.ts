/**
 * Additional Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 743-746
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PUT(request: NextRequest) {
  try {
    // Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
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
    const { knowledge } = body;

    if (!knowledge) {
      return NextResponse.json({ error: "Knowledge data required" }, { status: 400 });
    }

    // Upsert knowledge (create or update)
    const { error: upsertError } = await (supabase as any)
      .from("knowledge")
      .upsert(
        {
          business_id: businessId,
          content: knowledge.content || null,
          never_say: knowledge.never_say || null,
        },
        { onConflict: "business_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to save knowledge" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
