/**
 * Call Features Settings API Route
 * Retell AI Advanced Features
 *
 * PUT /api/dashboard/settings/call-features
 * Updates: Voicemail detection, silence handling, DTMF, denoising
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { updateAgentAdvancedSettings } from "@/lib/retell";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

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
      // Voicemail Detection
      voicemailDetectionEnabled,
      voicemailMessage,
      voicemailDetectionTimeoutMs,
      // Silence Handling
      reminderTriggerMs,
      reminderMaxCount,
      endCallAfterSilenceMs,
      // DTMF Input
      dtmfEnabled,
      dtmfDigitLimit,
      dtmfTerminationKey,
      dtmfTimeoutMs,
      // Denoising
      denoisingMode,
      // Responsiveness (how quickly Koya responds and stops when caller talks)
      interruptionSensitivity,
      responsiveness,
    } = body;

    // Validate timeouts are within acceptable ranges
    if (voicemailDetectionTimeoutMs && (voicemailDetectionTimeoutMs < 5000 || voicemailDetectionTimeoutMs > 180000)) {
      return NextResponse.json({ error: "Voicemail timeout must be between 5-180 seconds" }, { status: 400 });
    }
    if (reminderTriggerMs && (reminderTriggerMs < 5000 || reminderTriggerMs > 60000)) {
      return NextResponse.json({ error: "Reminder trigger must be between 5-60 seconds" }, { status: 400 });
    }
    if (endCallAfterSilenceMs && (endCallAfterSilenceMs < 10000 || endCallAfterSilenceMs > 120000)) {
      return NextResponse.json({ error: "End call silence must be between 10-120 seconds" }, { status: 400 });
    }
    // Validate responsiveness settings are within 0-1 range
    if (interruptionSensitivity !== undefined && (interruptionSensitivity < 0 || interruptionSensitivity > 1)) {
      return NextResponse.json({ error: "Interruption sensitivity must be between 0 and 1" }, { status: 400 });
    }
    if (responsiveness !== undefined && (responsiveness < 0 || responsiveness > 1)) {
      return NextResponse.json({ error: "Responsiveness must be between 0 and 1" }, { status: 400 });
    }

    // Use admin client for updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = createAdminClient() as any;

    // Upsert call settings
    const { data: callSettings, error: updateError } = await adminSupabase
      .from("call_settings")
      .upsert(
        {
          business_id: business.id,
          // Voicemail Detection
          voicemail_detection_enabled: voicemailDetectionEnabled ?? false,
          voicemail_message: voicemailMessage || null,
          voicemail_detection_timeout_ms: voicemailDetectionTimeoutMs || 30000,
          // Silence Handling
          reminder_trigger_ms: reminderTriggerMs || 10000,
          reminder_max_count: reminderMaxCount ?? 2,
          end_call_after_silence_ms: endCallAfterSilenceMs || 30000,
          // DTMF Input
          dtmf_enabled: dtmfEnabled ?? false,
          dtmf_digit_limit: dtmfDigitLimit || 10,
          dtmf_termination_key: dtmfTerminationKey || "#",
          dtmf_timeout_ms: dtmfTimeoutMs || 5000,
          // Denoising
          denoising_mode: denoisingMode || "noise-cancellation",
          // Responsiveness (default to high values for responsive behavior)
          interruption_sensitivity: interruptionSensitivity ?? 0.9,
          responsiveness: responsiveness ?? 0.9,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (updateError) {
      logError("Call Features Update DB", updateError);
      return NextResponse.json(
        { error: "Failed to update call features settings" },
        { status: 500 }
      );
    }

    // Get the Retell agent ID to update
    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id")
      .eq("business_id", business.id)
      .single();

    // Update Retell agent with new settings
    if (aiConfig?.retell_agent_id) {
      const updateSuccess = await updateAgentAdvancedSettings(aiConfig.retell_agent_id, {
        voicemailDetection: {
          enabled: voicemailDetectionEnabled ?? false,
          message: voicemailMessage || undefined,
          timeoutMs: voicemailDetectionTimeoutMs || 30000,
        },
        silenceHandling: {
          reminderTriggerMs: reminderTriggerMs || 10000,
          reminderMaxCount: reminderMaxCount ?? 2,
          endCallAfterSilenceMs: endCallAfterSilenceMs || 30000,
        },
        dtmf: {
          enabled: dtmfEnabled ?? false,
          digitLimit: dtmfDigitLimit || 10,
          terminationKey: dtmfTerminationKey || "#",
          timeoutMs: dtmfTimeoutMs || 5000,
        },
        denoisingMode: denoisingMode || "noise-cancellation",
        responsiveness: {
          interruptionSensitivity: interruptionSensitivity ?? 0.9,
          responseSpeed: responsiveness ?? 0.9,
        },
      });

      if (!updateSuccess) {
        // Settings are saved to DB, agent update can be retried
      }
    }

    return NextResponse.json({
      success: true,
      data: callSettings,
    });
  } catch (error) {
    logError("Settings Call-Features PUT", error);
    return NextResponse.json(
      { error: "Failed to update call features settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
