/**
 * Advanced AI Settings API
 * PUT /api/dashboard/settings/advanced-ai
 *
 * Updates the prompt_config in ai_config table for enhanced prompt features.
 * Also handles boosted keywords, custom summary prompts, and PII redaction.
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { updateAgentAdvancedSettings } from "@/lib/retell";
import { logError } from "@/lib/logging";

interface PromptConfig {
  industryEnhancements: boolean;
  fewShotExamplesEnabled: boolean;
  sentimentDetectionLevel: "none" | "basic" | "advanced";
  callerContextEnabled: boolean;
  toneIntensity: 1 | 2 | 3 | 4 | 5;
  personalityAwareErrors: boolean;
  maxFewShotExamples: number;
}

interface AdvancedAIRequest extends PromptConfig {
  // Retell advanced features
  boostedKeywords?: string;
  analysisSummaryPrompt?: string;
  analysisModel?: string;
  piiRedactionEnabled?: boolean;
  piiCategories?: string[];
}

const VALID_ANALYSIS_MODELS = ["gpt-4.1-mini", "claude-4.5-sonnet", "gemini-2.5-flash"];
const VALID_PII_CATEGORIES = ["ssn", "credit_card", "phone_number", "email", "date_of_birth", "address"];

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
  let body: AdvancedAIRequest;
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

  // Validate analysis model if provided
  if (body.analysisModel && !VALID_ANALYSIS_MODELS.includes(body.analysisModel)) {
    return NextResponse.json(
      { error: "Invalid analysis model" },
      { status: 400 }
    );
  }

  // Validate PII categories if provided
  if (body.piiCategories) {
    const invalidCategories = body.piiCategories.filter(c => !VALID_PII_CATEGORIES.includes(c));
    if (invalidCategories.length > 0) {
      return NextResponse.json(
        { error: `Invalid PII categories: ${invalidCategories.join(", ")}` },
        { status: 400 }
      );
    }
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

  // Parse boosted keywords from comma-separated string
  const boostedKeywords = body.boostedKeywords
    ? body.boostedKeywords.split(",").map(k => k.trim()).filter(Boolean)
    : [];

  // Use admin client for updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase = createAdminClient() as any;

  // Update ai_config table with prompt_config and new Retell features
  const { data: aiConfig, error: updateError } = await adminSupabase
    .from("ai_config")
    .update({
      prompt_config: promptConfig,
      boosted_keywords: boostedKeywords,
      analysis_summary_prompt: body.analysisSummaryPrompt || null,
      analysis_model: body.analysisModel || "gpt-4.1-mini",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .select("retell_agent_id")
    .single();

  if (updateError) {
    logError("Advanced AI Update ai_config", updateError);
    return NextResponse.json(
      { error: "Failed to save advanced AI settings" },
      { status: 500 }
    );
  }

  // Update call_settings for PII redaction
  const { error: callSettingsError } = await adminSupabase
    .from("call_settings")
    .upsert({
      business_id: businessId,
      pii_redaction_enabled: body.piiRedactionEnabled ?? false,
      pii_categories: body.piiCategories || ["ssn", "credit_card"],
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id" });

  if (callSettingsError) {
    logError("Advanced AI Update call_settings", callSettingsError);
    // Don't fail - ai_config was updated successfully
  }

  // Update Retell agent with new settings
  if (aiConfig?.retell_agent_id) {
    try {
      await updateAgentAdvancedSettings(aiConfig.retell_agent_id, {
        boostedKeywords,
        summaryConfig: {
          prompt: body.analysisSummaryPrompt || undefined,
          model: body.analysisModel || "gpt-4.1-mini",
        },
        piiConfig: {
          enabled: body.piiRedactionEnabled ?? false,
          categories: body.piiCategories || ["ssn", "credit_card"],
        },
      });
    } catch (error) {
      // Log but don't fail - settings are saved to DB
      logError("Advanced AI Update Retell Agent", error);
    }
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

  const defaultRetellConfig = {
    boostedKeywords: [],
    analysisSummaryPrompt: "",
    analysisModel: "gpt-4.1-mini",
  };

  if (configError) {
    // Return defaults if no config exists
    return NextResponse.json({
      promptConfig: defaultConfig,
      ...defaultRetellConfig,
      piiRedactionEnabled: false,
      piiCategories: ["ssn", "credit_card"],
    });
  }

  // Extract all config values using type assertion
  const configData = aiConfig as Record<string, unknown> | null;

  // Get call_settings for PII config
  const { data: callSettings } = await supabase
    .from("call_settings")
    .select("pii_redaction_enabled, pii_categories")
    .eq("business_id", businessId)
    .single();

  const callSettingsData = callSettings as Record<string, unknown> | null;

  return NextResponse.json({
    promptConfig: configData?.prompt_config || defaultConfig,
    boostedKeywords: (configData?.boosted_keywords as string[])?.join(", ") || "",
    analysisSummaryPrompt: configData?.analysis_summary_prompt || "",
    analysisModel: configData?.analysis_model || "gpt-4.1-mini",
    piiRedactionEnabled: callSettingsData?.pii_redaction_enabled ?? false,
    piiCategories: callSettingsData?.pii_categories || ["ssn", "credit_card"],
  });
}
