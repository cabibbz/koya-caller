/**
 * Call Handling Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 750-760
 *
 * PUT /api/dashboard/settings/call-handling
 * Updates: Transfer settings, after-hours behavior, call routing
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { queuePromptRegeneration } from "@/lib/claude/queue";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      transferNumber,
      backupTransferNumber,
      transferOnRequest,
      transferOnEmergency,
      transferOnUpset,
      transferKeywords,
      transferHoursType,
      afterHoursEnabled,
      afterHoursCanBook,
      afterHoursMessageOnly,
      maxCallDurationSeconds,
      recordingEnabled,
    } = body;

    // Upsert call settings
    const { data: callSettings, error: updateError } = await (supabase as any)
      .from("call_settings")
      .upsert(
        {
          business_id: business.id,
          transfer_number: transferNumber || null,
          backup_transfer_number: backupTransferNumber || null,
          transfer_on_request: transferOnRequest ?? true,
          transfer_on_emergency: transferOnEmergency ?? true,
          transfer_on_upset: transferOnUpset ?? false,
          transfer_keywords: transferKeywords
            ? transferKeywords.split(",").map((k: string) => k.trim()).filter(Boolean)
            : [],
          transfer_hours_type: transferHoursType || "always",
          after_hours_enabled: afterHoursEnabled ?? true,
          after_hours_can_book: afterHoursCanBook ?? true,
          after_hours_message_only: afterHoursMessageOnly ?? false,
          max_call_duration_seconds: maxCallDurationSeconds || 600,
          recording_enabled: recordingEnabled ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (updateError) {
      console.error("[Call Handling API] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update call settings" },
        { status: 500 }
      );
    }

    // Queue prompt regeneration for settings changes
    await queuePromptRegeneration(supabase, business.id, "settings_update");

    return NextResponse.json({
      success: true,
      data: callSettings,
    });
  } catch (error) {
    console.error("[Call Handling API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update call settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
