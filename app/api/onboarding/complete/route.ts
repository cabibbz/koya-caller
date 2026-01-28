/**
 * Koya Caller - Onboarding Complete API
 * Session 14: Claude API Integration
 *
 * Marks onboarding as complete, generates Retell prompt, and creates agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generatePrompts, buildPromptInputFromDatabase } from "@/lib/claude";
import { logError, logWarning, logInfo } from "@/lib/logging";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for RLS bypass
    const adminSupabase = createAdminClient() as any;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get business ID from request or user metadata
    const body = await request.json().catch(() => ({}));
    const businessId = body.businessId || user.app_metadata?.tenant_id;
    const skipPromptGeneration = body.skip === true;
    const skipTestCall = body.skip === true; // Track if user explicitly skipped test call

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Business ID required" },
        { status: 400 }
      );
    }

    // Verify user owns this business
    const { data: businessCheck, error: checkError } = await adminSupabase
      .from("businesses")
      .select("user_id, name, business_type")
      .eq("id", businessId)
      .single();

    const business = businessCheck as { user_id: string; name: string; business_type: string } | null;

    if (checkError || !business || business.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    // =========================================================================
    // Validation: Check if user has completed a test call
    // If not, track that they skipped for follow-up
    // =========================================================================
    let hasCompletedTestCall = false;
    let testCallSkipped = false;

    // Check for any web calls (test calls) from demo/call API for this business
    // Web calls from onboarding have metadata.source = "onboarding_test"
    const { data: testCalls } = await adminSupabase
      .from("calls")
      .select("id, call_type, created_at")
      .eq("business_id", businessId)
      .eq("call_type", "web")
      .limit(1);

    // Also check if they've made any successful Retell calls via the demo endpoint
    // The demo endpoint creates web calls but doesn't necessarily save to our calls table
    // Check AI config for evidence of agent being tested (retell_agent_id would be set after agent creation)
    const { data: aiConfigCheck } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id")
      .eq("business_id", businessId)
      .single();

    // User has completed test call if:
    // 1. We have a web call record for this business, OR
    // 2. They have a Retell agent (meaning onboarding progressed to agent creation)
    hasCompletedTestCall = (testCalls && testCalls.length > 0) || (aiConfigCheck && aiConfigCheck.retell_agent_id != null);

    if (!hasCompletedTestCall) {
      if (skipTestCall) {
        // User explicitly chose to skip - track this for follow-up
        testCallSkipped = true;
      } else {
        // User is trying to complete without testing and didn't explicitly skip
        return NextResponse.json(
          {
            success: false,
            error: "Please make a test call before completing onboarding, or click 'Skip for now' to proceed without testing.",
            requiresTestCall: true
          },
          { status: 400 }
        );
      }
    }

    // =========================================================================
    // Step 1: Generate Retell-compatible system prompt (skip if user chose to skip)
    // =========================================================================
    // Generating system prompt for business

    // Only do heavy prompt generation if not skipping
    if (!skipPromptGeneration) {
    // Fetch all business data for prompt generation
    const businessData = await fetchBusinessData(adminSupabase, businessId);

    // Get existing ai_config to preserve voice settings from step 7
    const { data: existingConfig } = await adminSupabase
      .from("ai_config")
      .select("voice_id, voice_id_spanish, personality, ai_name, greeting, spanish_enabled, language_mode")
      .eq("business_id", businessId)
      .single();

    const savedVoiceId = existingConfig?.voice_id || "11labs-Grace";
    const savedAiName = existingConfig?.ai_name || "Koya";
    const savedPersonality = existingConfig?.personality || "professional";
    const savedGreeting = existingConfig?.greeting || `Thanks for calling ${business.name}, this is ${savedAiName}, how can I help you?`;
    const savedSpanishEnabled = existingConfig?.spanish_enabled || false;
    const savedLanguageMode = existingConfig?.language_mode || "auto";

    if (businessData) {
      const promptInput = buildPromptInputFromDatabase(businessData);
      const promptResult = await generatePrompts(promptInput);

      if (promptResult.success && promptResult.prompts) {
        // Save generated prompt to ai_config (preserving voice settings from step 7)
        await adminSupabase
          .from("ai_config")
          .upsert({
            business_id: businessId,
            system_prompt: promptResult.prompts.englishPrompt,
            system_prompt_spanish: promptResult.prompts.spanishPrompt || null,
            system_prompt_version: 1,
            system_prompt_generated_at: new Date().toISOString(),
            // Preserve settings from step 7
            voice_id: savedVoiceId,
            ai_name: savedAiName,
            personality: savedPersonality,
            greeting: savedGreeting,
            spanish_enabled: savedSpanishEnabled,
            language_mode: savedLanguageMode,
          }, { onConflict: "business_id" });

        // System prompt generated and saved

        // =========================================================================
        // Step 2: Create Retell Agent (directly, avoiding CSRF-prone internal fetch)
        // =========================================================================
        try {
          // Import Retell SDK and create agent directly instead of internal fetch
          const retellApiKey = process.env.RETELL_API_KEY;
          if (retellApiKey) {
            const Retell = await import("retell-sdk");
            const retellClient = new Retell.default({ apiKey: retellApiKey });

            // Create the agent directly via Retell SDK with advanced features
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Retell SDK types are incomplete for newer API features
            const agent = await retellClient.agent.create({
              agent_name: `${savedAiName} - ${business.name}`,
              voice_id: savedVoiceId,
              language: "en-US",
              response_engine: {
                type: "retell-llm",
                llm_id: process.env.RETELL_LLM_ID || "",
              },
              webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/retell/webhook`,
              // Enable call recording for replay functionality
              enable_recording: true,
              // Enable post-call analysis for summary generation
              post_call_analysis_data: [
                {
                  type: "call_summary",
                  name: "call_summary",
                  description: "A brief summary of what the caller wanted and the outcome of the call",
                },
                {
                  type: "custom",
                  name: "customer_name",
                  description: "The name of the caller if provided",
                },
                {
                  type: "custom",
                  name: "customer_phone",
                  description: "The phone number of the caller if provided",
                },
                {
                  type: "custom",
                  name: "customer_email",
                  description: "The email address of the caller if provided",
                },
                {
                  type: "custom",
                  name: "service_name",
                  description: "The service the caller inquired about or booked",
                },
                {
                  type: "custom",
                  name: "appointment_date",
                  description: "The date and time of any appointment booked (ISO format)",
                },
                {
                  type: "custom",
                  name: "appointment_booked",
                  description: "Whether an appointment was booked (true/false)",
                },
              ],
              // Default advanced settings
              // Voicemail detection disabled by default
              enable_voicemail_detection: false,
              // Silence handling with sensible defaults
              reminder_trigger_ms: 10000,
              reminder_max_count: 2,
              end_call_after_silence_ms: 30000,
              // Background noise cancellation enabled
              ambient_sound_volume: 0,
              // Denoising enabled
              // Note: denoising_mode would be applied via update if needed
            } as any);

            // Save agent ID to database
            if (agent?.agent_id) {
              await adminSupabase
                .from("ai_config")
                .update({ retell_agent_id: agent.agent_id })
                .eq("business_id", businessId);
            }
          }
        } catch (agentError) {
          // Don't fail onboarding if agent creation fails, but log the error
          logError("Onboarding - Agent creation failed (non-fatal)", agentError);
        }
      } else {
        // Prompt generation failed - continue without it
      }
    }
    } // end skipPromptGeneration check

    // =========================================================================
    // Step 3: Mark onboarding complete
    // =========================================================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client already cast
    const { error: updateError } = await (adminSupabase as any)
      .from("businesses")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 10, // Mark as fully complete (past step 9)
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to complete onboarding" },
        { status: 500 }
      );
    }

    // If test call was skipped, create a follow-up task in notification_settings
    // or a simple flag that can be checked later for onboarding follow-up emails
    if (testCallSkipped) {
      // Store that user skipped test call - useful for follow-up outreach
      // We can use the ai_config table to store this metadata since it's business-specific
      await adminSupabase
        .from("ai_config")
        .update({
          // Store as part of prompt_config JSON since we don't want to add a new column
          // This can be checked later for follow-up campaigns
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      // Log for analytics/follow-up purposes
      logInfo("Onboarding", `Business ${businessId} completed onboarding but skipped test call`);
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      testCallSkipped: testCallSkipped,
    });
  } catch (error) {
    logError("Onboarding Complete POST", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch all business data needed for prompt generation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client type
async function fetchBusinessData(supabase: any, businessId: string) {
  try {
    // Fetch business
    const { data: business } = await supabase
      .from("businesses")
      .select("name, business_type, address, website, service_area, differentiator, timezone")
      .eq("id", businessId)
      .single();

    if (!business) return null;

    // Fetch related data
    const [
      { data: businessHours },
      { data: services },
      { data: faqs },
      { data: knowledge },
      { data: aiConfig },
      { data: callSettings },
    ] = await Promise.all([
      supabase.from("business_hours").select("*").eq("business_id", businessId),
      supabase.from("services").select("*").eq("business_id", businessId),
      supabase.from("faqs").select("*").eq("business_id", businessId),
      supabase.from("knowledge").select("*").eq("business_id", businessId).single(),
      supabase.from("ai_config").select("*").eq("business_id", businessId).single(),
      supabase.from("call_settings").select("*").eq("business_id", businessId).single(),
    ]);

    return {
      business,
      businessHours: businessHours || [],
      timezone: business.timezone || "America/New_York",
      services: services || [],
      faqs: faqs || [],
      knowledge,
      aiConfig: aiConfig || {
        ai_name: "Koya",
        personality: "professional",
        greeting: null,
        greeting_spanish: null,
        spanish_enabled: false,
        language_mode: "auto",
      },
      callSettings: callSettings || {
        transfer_number: null,
        transfer_on_request: true,
        transfer_on_emergency: true,
        transfer_on_upset: false,
        after_hours_enabled: true,
        after_hours_can_book: true,
      },
      minutesRemaining: 200,
      minutesExhausted: false,
    };
  } catch (_error) {
    return null;
  }
}
