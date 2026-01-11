/**
 * Advanced AI Settings API
 * PUT /api/dashboard/settings/advanced-ai
 *
 * Updates the prompt_config in ai_config table for enhanced prompt features.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PromptConfig {
  industryEnhancements: boolean;
  fewShotExamplesEnabled: boolean;
  sentimentDetectionLevel: "none" | "basic" | "advanced";
  callerContextEnabled: boolean;
  toneIntensity: 1 | 2 | 3 | 4 | 5;
  personalityAwareErrors: boolean;
  maxFewShotExamples: number;
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get business
  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (businessError || !businessData) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 }
    );
  }

  const businessId = (businessData as { id: string }).id;

  // Parse request body
  let body: PromptConfig;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Validate settings
  const validSentimentLevels = ["none", "basic", "advanced"];
  if (!validSentimentLevels.includes(body.sentimentDetectionLevel)) {
    return NextResponse.json(
      { error: "Invalid sentiment detection level" },
      { status: 400 }
    );
  }

  if (body.toneIntensity < 1 || body.toneIntensity > 5) {
    return NextResponse.json(
      { error: "Tone intensity must be between 1 and 5" },
      { status: 400 }
    );
  }

  if (body.maxFewShotExamples < 1 || body.maxFewShotExamples > 5) {
    return NextResponse.json(
      { error: "Max few-shot examples must be between 1 and 5" },
      { status: 400 }
    );
  }

  // Construct prompt_config object
  const promptConfig: PromptConfig = {
    industryEnhancements: Boolean(body.industryEnhancements),
    fewShotExamplesEnabled: Boolean(body.fewShotExamplesEnabled),
    sentimentDetectionLevel: body.sentimentDetectionLevel,
    callerContextEnabled: Boolean(body.callerContextEnabled),
    toneIntensity: body.toneIntensity,
    personalityAwareErrors: Boolean(body.personalityAwareErrors),
    maxFewShotExamples: body.maxFewShotExamples,
  };

  // Update ai_config table
  // Note: prompt_config column added by migration 20250110000001
  const { error: updateError } = await (supabase as any)
    .from("ai_config")
    .update({
      prompt_config: promptConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save advanced AI settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get business
  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (businessError || !businessData) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 }
    );
  }

  const businessId = (businessData as { id: string }).id;

  // Get ai_config with prompt_config
  // Note: prompt_config column added by migration 20250110000001
  const { data: aiConfig, error: configError } = await supabase
    .from("ai_config")
    .select("*")
    .eq("business_id", businessId)
    .single();

  const defaultConfig = {
    industryEnhancements: true,
    fewShotExamplesEnabled: true,
    sentimentDetectionLevel: "basic",
    callerContextEnabled: true,
    toneIntensity: 3,
    personalityAwareErrors: true,
    maxFewShotExamples: 3,
  };

  if (configError) {
    // Return defaults if no config exists
    return NextResponse.json({ promptConfig: defaultConfig });
  }

  // Extract prompt_config using type assertion
  const configWithPrompt = aiConfig as Record<string, unknown> | null;
  return NextResponse.json({
    promptConfig: configWithPrompt?.prompt_config || defaultConfig,
  });
}
