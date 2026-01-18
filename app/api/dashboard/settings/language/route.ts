/**
 * Language Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 772-778
 *
 * PUT /api/dashboard/settings/language
 * Updates: Spanish enabled, language mode
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { triggerImmediateRegeneration } from "@/lib/claude/queue";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_LANGUAGE_MODES = ["auto", "ask", "spanish_default"];

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
    const { spanishEnabled, languageMode, greetingSpanish, afterHoursGreetingSpanish } = body;

    // Validate language mode
    if (languageMode && !VALID_LANGUAGE_MODES.includes(languageMode)) {
      return NextResponse.json(
        { error: "Invalid language mode. Must be: auto, ask, or spanish_default" },
        { status: 400 }
      );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: aiConfig, error: updateError } = await (supabase as any)
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update language settings" },
        { status: 500 }
      );
    }

    // Trigger immediate prompt regeneration and Retell sync
    // (Don't await - let it run in background, settings are already saved)
    triggerImmediateRegeneration(business.id).catch((error) => {
      logError("Language Settings - Retell Sync", error);
    });

    return NextResponse.json({
      success: true,
      data: aiConfig,
    });
  } catch (error) {
    logError("Settings Language PUT", error);
    return NextResponse.json(
      { error: "Failed to update language settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
