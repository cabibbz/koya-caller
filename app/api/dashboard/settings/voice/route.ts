/**
 * Voice & Personality Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 762-770
 *
 * PUT /api/dashboard/settings/voice
 * Updates: Voice selection, personality, AI name, greetings
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/server";
import { queuePromptRegeneration } from "@/lib/claude/queue";
import { updateAgentAdvancedSettings, updateAgent } from "@/lib/retell";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_PERSONALITIES = ["professional", "friendly", "casual"];

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const {
      voiceId,
      voiceIdSpanish,
      aiName,
      personality,
      greeting,
      greetingSpanish,
      afterHoursGreeting,
      afterHoursGreetingSpanish,
      fallbackVoiceIds,
      // Voice control settings
      voiceTemperature,
      voiceSpeed,
      voiceVolume,
      beginMessageDelayMs,
    } = body;

    // Validate personality
    if (personality && !VALID_PERSONALITIES.includes(personality)) {
      return errors.badRequest("Invalid personality. Must be: professional, friendly, or casual");
    }

    // Validate string lengths to prevent abuse
    const MAX_AI_NAME_LENGTH = 50;
    const MAX_GREETING_LENGTH = 500;
    const MAX_VOICE_ID_LENGTH = 100;

    if (aiName && typeof aiName === "string" && aiName.length > MAX_AI_NAME_LENGTH) {
      return errors.badRequest(`AI name must be ${MAX_AI_NAME_LENGTH} characters or less`);
    }
    if (greeting && typeof greeting === "string" && greeting.length > MAX_GREETING_LENGTH) {
      return errors.badRequest(`Greeting must be ${MAX_GREETING_LENGTH} characters or less`);
    }
    if (greetingSpanish && typeof greetingSpanish === "string" && greetingSpanish.length > MAX_GREETING_LENGTH) {
      return errors.badRequest(`Spanish greeting must be ${MAX_GREETING_LENGTH} characters or less`);
    }
    if (afterHoursGreeting && typeof afterHoursGreeting === "string" && afterHoursGreeting.length > MAX_GREETING_LENGTH) {
      return errors.badRequest(`After-hours greeting must be ${MAX_GREETING_LENGTH} characters or less`);
    }
    if (afterHoursGreetingSpanish && typeof afterHoursGreetingSpanish === "string" && afterHoursGreetingSpanish.length > MAX_GREETING_LENGTH) {
      return errors.badRequest(`Spanish after-hours greeting must be ${MAX_GREETING_LENGTH} characters or less`);
    }
    if (voiceId && typeof voiceId === "string" && voiceId.length > MAX_VOICE_ID_LENGTH) {
      return errors.badRequest(`Voice ID must be ${MAX_VOICE_ID_LENGTH} characters or less`);
    }
    if (voiceIdSpanish && typeof voiceIdSpanish === "string" && voiceIdSpanish.length > MAX_VOICE_ID_LENGTH) {
      return errors.badRequest(`Spanish voice ID must be ${MAX_VOICE_ID_LENGTH} characters or less`);
    }

    // Validate numeric fields are actually numbers
    if (voiceTemperature !== undefined && typeof voiceTemperature !== "number") {
      return errors.badRequest("voiceTemperature must be a number");
    }
    if (voiceSpeed !== undefined && typeof voiceSpeed !== "number") {
      return errors.badRequest("voiceSpeed must be a number");
    }
    if (voiceVolume !== undefined && typeof voiceVolume !== "number") {
      return errors.badRequest("voiceVolume must be a number");
    }
    if (beginMessageDelayMs !== undefined && typeof beginMessageDelayMs !== "number") {
      return errors.badRequest("beginMessageDelayMs must be a number");
    }

    // Validate fallbackVoiceIds is an array of strings
    if (fallbackVoiceIds !== undefined && fallbackVoiceIds !== null) {
      if (!Array.isArray(fallbackVoiceIds)) {
        return errors.badRequest("fallbackVoiceIds must be an array");
      }
      if (fallbackVoiceIds.length > 10) {
        return errors.badRequest("Maximum 10 fallback voice IDs allowed");
      }
      for (const id of fallbackVoiceIds) {
        if (typeof id !== "string" || id.length > MAX_VOICE_ID_LENGTH) {
          return errors.badRequest("Each fallback voice ID must be a valid string");
        }
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      business_id: business.id,
      updated_at: new Date().toISOString(),
    };

    if (voiceId !== undefined) updateData.voice_id = voiceId;
    if (voiceIdSpanish !== undefined) updateData.voice_id_spanish = voiceIdSpanish;
    if (aiName !== undefined) updateData.ai_name = aiName || "Koya";
    if (personality !== undefined) updateData.personality = personality;
    if (greeting !== undefined) updateData.greeting = greeting;
    if (greetingSpanish !== undefined) updateData.greeting_spanish = greetingSpanish;
    if (afterHoursGreeting !== undefined) updateData.after_hours_greeting = afterHoursGreeting;
    if (afterHoursGreetingSpanish !== undefined) updateData.after_hours_greeting_spanish = afterHoursGreetingSpanish;
    if (fallbackVoiceIds !== undefined) updateData.fallback_voice_ids = fallbackVoiceIds || [];
    // Voice control settings
    if (voiceTemperature !== undefined) updateData.voice_temperature = Math.max(0, Math.min(2, voiceTemperature));
    if (voiceSpeed !== undefined) updateData.voice_speed = Math.max(0.5, Math.min(2, voiceSpeed));
    if (voiceVolume !== undefined) updateData.voice_volume = Math.max(0, Math.min(2, voiceVolume));
    if (beginMessageDelayMs !== undefined) updateData.begin_message_delay_ms = Math.max(0, Math.min(5000, beginMessageDelayMs));

    // Use admin client for updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = createAdminClient() as any;

    // Upsert AI config
    const { data: aiConfig, error: updateError } = await adminSupabase
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      logError("Voice settings update", updateError);
      return errors.internalError("Failed to update voice settings");
    }

    // Update Retell agent's main voice if changed
    if (voiceId !== undefined && aiConfig?.retell_agent_id) {
      try {
        await updateAgent(aiConfig.retell_agent_id, { voiceId });
      } catch (error) {
        // Log but don't fail - settings are saved to DB
        logError("Voice Update Retell Agent Voice", error);
      }
    }

    // Update Retell agent with advanced voice settings if changed
    const hasAdvancedVoiceUpdates =
      fallbackVoiceIds !== undefined ||
      voiceTemperature !== undefined ||
      voiceSpeed !== undefined ||
      voiceVolume !== undefined ||
      beginMessageDelayMs !== undefined;

    if (hasAdvancedVoiceUpdates && aiConfig?.retell_agent_id) {
      try {
        await updateAgentAdvancedSettings(aiConfig.retell_agent_id, {
          fallbackVoices: fallbackVoiceIds !== undefined ? (fallbackVoiceIds || []) : undefined,
          voiceControls: {
            temperature: voiceTemperature,
            speed: voiceSpeed,
            volume: voiceVolume,
            beginMessageDelayMs: beginMessageDelayMs,
          },
        });
      } catch (error) {
        // Log but don't fail - settings are saved to DB
        logError("Voice Update Retell Agent Settings", error);
      }
    }

    // Queue prompt regeneration (use admin client for permissions)
    try {
      await queuePromptRegeneration(adminSupabase, business.id, "settings_update");
    } catch (_queueError) {
      // Non-fatal - voice settings saved successfully
    }

    return success(aiConfig);
  } catch (error) {
    logError("Settings Voice PUT", error);
    return errors.internalError("Failed to update voice settings");
  }
}

// Apply auth middleware with rate limiting
export const PUT = withAuth(handlePut);
