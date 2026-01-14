/**
 * Voice & Personality Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 762-770
 *
 * PUT /api/dashboard/settings/voice
 * Updates: Voice selection, personality, AI name, greetings
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { queuePromptRegeneration } from "@/lib/claude/queue";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_PERSONALITIES = ["professional", "friendly", "casual"];

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
      voiceId,
      voiceIdSpanish,
      aiName,
      personality,
      greeting,
      greetingSpanish,
      afterHoursGreeting,
      afterHoursGreetingSpanish,
    } = body;

    // Validate personality
    if (personality && !VALID_PERSONALITIES.includes(personality)) {
      return NextResponse.json(
        { error: "Invalid personality. Must be: professional, friendly, or casual" },
        { status: 400 }
      );
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

    // Upsert AI config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: aiConfig, error: updateError } = await (supabase as any)
      .from("ai_config")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update voice settings" },
        { status: 500 }
      );
    }

    // Queue prompt regeneration
    await queuePromptRegeneration(supabase, business.id, "settings_update");

    return NextResponse.json({
      success: true,
      data: aiConfig,
    });
  } catch (error) {
    logError("Settings Voice PUT", error);
    return NextResponse.json(
      { error: "Failed to update voice settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
