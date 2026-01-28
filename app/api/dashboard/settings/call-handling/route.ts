/**
 * Call Handling Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 750-760
 *
 * PUT /api/dashboard/settings/call-handling
 * Updates: Transfer settings, after-hours behavior, call routing
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/server";
import { triggerImmediateRegeneration } from "@/lib/claude/queue";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const {
      transferNumber,
      backupTransferNumber,
      transferOnRequest,
      transferOnEmergency,
      transferOnUpset,
      transferKeywords,
      transferHoursType,
      transferHoursCustom,
      afterHoursEnabled,
      afterHoursCanBook,
      afterHoursMessageOnly,
      maxCallDurationSeconds,
      recordingEnabled,
    } = body;

    // Use admin client to bypass RLS (user already authenticated by middleware)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = createAdminClient() as any;

    // Upsert call settings
    const { data: callSettings, error: updateError } = await adminSupabase
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
          transfer_hours_custom: transferHoursType === "custom" ? transferHoursCustom : null,
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
      logError("Call Settings Upsert", updateError);
      return errors.internalError("Failed to update call settings");
    }

    // Trigger immediate prompt regeneration and Retell sync
    // (Don't await - let it run in background, settings are already saved)
    triggerImmediateRegeneration(business.id).catch((error) => {
      logError("Call Handling - Retell Sync", error);
    });

    return success(callSettings);
  } catch (error) {
    logError("Settings Call-Handling PUT", error);
    return errors.internalError("Failed to update call settings");
  }
}

export const PUT = withAuth(handlePut);
