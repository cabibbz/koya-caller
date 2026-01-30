/**
 * Onboarding Phase 1 API
 * Saves business type and name from conversational onboarding
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessType, businessTypeName, businessName, websiteUrl, businessHours, calendarProvider, greeting } = body;

    if (!businessType) {
      return NextResponse.json(
        { error: "Business type is required" },
        { status: 400 }
      );
    }

    // Get or create business
    const tenantId = user.app_metadata?.tenant_id;

    let currentBusinessId = tenantId;

    if (tenantId) {
      // Update existing business
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { error } = await (supabase as any)
        .from("businesses")
        .update({
          business_type: businessType,
          name: businessName || businessTypeName,
          website: websiteUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (error) throw error;
    } else {
      // Create new business
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: newBusiness, error: createError } = await (supabase as any)
        .from("businesses")
        .insert({
          user_id: user.id,
          business_type: businessType,
          name: businessName || businessTypeName,
          website: websiteUrl || null,
          onboarding_step: 2,
        })
        .select()
        .single();

      if (createError) throw createError;

      currentBusinessId = newBusiness.id;

      // Update user metadata with tenant_id
      await supabase.auth.updateUser({
        data: { tenant_id: newBusiness.id },
      });
    }

    // Store greeting in ai_config if provided
    if (greeting && currentBusinessId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      await (supabase as any)
        .from("ai_config")
        .upsert({
          business_id: currentBusinessId,
          greeting: greeting,
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });
    }

    // Store business hours if provided
    if (businessHours && currentBusinessId) {
      // Delete existing business hours
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      await (supabase as any)
        .from("business_hours")
        .delete()
        .eq("business_id", currentBusinessId);

      // Generate hours based on type
      const hoursToInsert = generateBusinessHours(businessHours.type, currentBusinessId);

      if (hoursToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
        await (supabase as any)
          .from("business_hours")
          .insert(hoursToInsert);
      }
    }

    // Store calendar provider if provided
    if (calendarProvider && currentBusinessId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      await (supabase as any)
        .from("calendar_integrations")
        .upsert({
          business_id: currentBusinessId,
          provider: calendarProvider,
          updated_at: new Date().toISOString(),
        }, { onConflict: "business_id" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Onboarding Phase1 POST", error);
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}

/**
 * Generate business hours rows based on preset type
 * Returns array of rows for business_hours table
 */
function generateBusinessHours(
  type: string,
  businessId: string
): {
  business_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}[] {
  const days = [0, 1, 2, 3, 4, 5, 6]; // Sunday = 0, Saturday = 6

  switch (type) {
    case "standard":
      // Mon-Fri 9am-5pm, Sat-Sun closed
      return days.map((day) => ({
        business_id: businessId,
        day_of_week: day,
        open_time: "09:00",
        close_time: "17:00",
        is_closed: day === 0 || day === 6, // Sunday or Saturday
      }));

    case "extended":
      // Mon-Fri 8am-6pm, Sat 9am-1pm, Sun closed
      return days.map((day) => ({
        business_id: businessId,
        day_of_week: day,
        open_time: day === 6 ? "09:00" : "08:00", // Sat opens at 9
        close_time: day === 6 ? "13:00" : "18:00", // Sat closes at 1pm
        is_closed: day === 0, // Only Sunday closed
      }));

    case "24_7":
      // All days 24 hours
      return days.map((day) => ({
        business_id: businessId,
        day_of_week: day,
        open_time: "00:00",
        close_time: "23:59",
        is_closed: false,
      }));

    case "custom":
    default:
      // Default to standard hours (user can customize later)
      return days.map((day) => ({
        business_id: businessId,
        day_of_week: day,
        open_time: "09:00",
        close_time: "17:00",
        is_closed: day === 0 || day === 6,
      }));
  }
}
