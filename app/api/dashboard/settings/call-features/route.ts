/**
 * Call Features Settings API Route
 * Retell AI Advanced Features
 *
 * PUT /api/dashboard/settings/call-features
 * Updates: Voicemail detection, silence handling, DTMF, denoising
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/server";
import { updateAgentAdvancedSettings } from "@/lib/retell";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
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
      return errors.badRequest("Voicemail timeout must be between 5-180 seconds");
    }
    if (reminderTriggerMs && (reminderTriggerMs < 5000 || reminderTriggerMs > 60000)) {
      return errors.badRequest("Reminder trigger must be between 5-60 seconds");
    }
    if (endCallAfterSilenceMs && (endCallAfterSilenceMs < 10000 || endCallAfterSilenceMs > 120000)) {
      return errors.badRequest("End call silence must be between 10-120 seconds");
    }
    // Validate responsiveness settings are within 0-1 range
    if (interruptionSensitivity !== undefined && (interruptionSensitivity < 0 || interruptionSensitivity > 1)) {
      return errors.badRequest("Interruption sensitivity must be between 0 and 1");
    }
    if (responsiveness !== undefined && (responsiveness < 0 || responsiveness > 1)) {
      return errors.badRequest("Responsiveness must be between 0 and 1");
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
      return errors.internalError("Failed to update call features settings");
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

    return success(callSettings);
  } catch (error) {
    logError("Settings Call-Features PUT", error);
    return errors.internalError("Failed to update call features settings");
  }
}

export const PUT = withAuth(handlePut);
