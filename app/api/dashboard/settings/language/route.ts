/**
 * Language Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 772-778
 *
 * PUT /api/dashboard/settings/language
 * Updates: Spanish enabled, language mode
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { triggerImmediateRegeneration } from "@/lib/claude/queue";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_LANGUAGE_MODES = ["auto", "ask", "spanish_default"];

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { spanishEnabled, languageMode, greetingSpanish, afterHoursGreetingSpanish } = body;

    // Validate language mode
    if (languageMode && !VALID_LANGUAGE_MODES.includes(languageMode)) {
      return errors.badRequest("Invalid language mode. Must be: auto, ask, or spanish_default");
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      business_id: business.id,
      updated_at: new Date().toISOString(),
    };

    if (spanishEnabled !== undefined) updateData.spanish_enabled = spanishEnabled;
    if (languageMode !== undefined) updateData.language_mode = languageMode;
    if (greetingSpanish !== undefined) updateData.greeting_spanish = greetingSpanish;
    if (afterHoursGreetingSpanish !== undefined) {
      updateData.after_hours_greeting_spanish = afterHoursGreetingSpanish;
    }

    // Upsert AI config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aiConfig, error: updateError } = await (supabase as any)
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      return errors.internalError("Failed to update language settings");
    }

    // Trigger immediate prompt regeneration and Retell sync
    // (Don't await - let it run in background, settings are already saved)
    triggerImmediateRegeneration(business.id).catch((error) => {
      logError("Language Settings - Retell Sync", error);
    });

    return success(aiConfig);
  } catch (error) {
    logError("Settings Language PUT", error);
    return errors.internalError("Failed to update language settings");
  }
}

export const PUT = withAuth(handlePut);
