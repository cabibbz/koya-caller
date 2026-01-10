/**
 * Business Info Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 735-741
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
    const { business: businessUpdate, businessHours } = body;

    // Update business info
    if (businessUpdate) {
      const { error: updateError } = await (supabase as any)
        .from("businesses")
        .update({
          name: businessUpdate.name,
          address: businessUpdate.address || null,
          website: businessUpdate.website || null,
          service_area: businessUpdate.service_area || null,
          differentiator: businessUpdate.differentiator || null,
        })
        .eq("id", businessId);

      if (updateError) {
        console.error("[Business API] Update error:", updateError);
        return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
      }
    }

    // Update business hours
    if (businessHours && Array.isArray(businessHours)) {
      // Delete existing hours
      const { error: deleteError } = await supabase
        .from("business_hours")
        .delete()
        .eq("business_id", businessId);

      if (deleteError) {
        console.error("[Business API] Hours delete error:", deleteError);
        return NextResponse.json({ error: "Failed to update hours" }, { status: 500 });
      }

      // Insert new hours
      if (businessHours.length > 0) {
        const hoursToInsert = businessHours.map((h: any) => ({
          business_id: businessId,
          day_of_week: h.day_of_week,
          is_closed: h.is_closed ?? false,
          open_time: h.open_time || null,
          close_time: h.close_time || null,
        }));

        const { error: insertError } = await (supabase as any)
          .from("business_hours")
          .insert(hoursToInsert);

        if (insertError) {
          console.error("[Business API] Hours insert error:", insertError);
          return NextResponse.json({ error: "Failed to save hours" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Business API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
