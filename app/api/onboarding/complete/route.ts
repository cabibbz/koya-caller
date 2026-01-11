/**
 * Koya Caller - Onboarding Complete API
 * Session 14: Claude API Integration
 *
 * Marks onboarding as complete, generates Retell prompt, and creates agent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generatePrompts, buildPromptInputFromDatabase } from "@/lib/claude";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
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
    // Step 1: Generate Retell-compatible system prompt
    // =========================================================================
    // Generating system prompt for business

    // Fetch all business data for prompt generation
    const businessData = await fetchBusinessData(adminSupabase, businessId);

    if (businessData) {
      const promptInput = buildPromptInputFromDatabase(businessData);
      const promptResult = await generatePrompts(promptInput);

      if (promptResult.success && promptResult.prompts) {
        // Save generated prompt to ai_config
        await adminSupabase
          .from("ai_config")
          .upsert({
            business_id: businessId,
            system_prompt: promptResult.prompts.englishPrompt,
            system_prompt_spanish: promptResult.prompts.spanishPrompt || null,
            system_prompt_version: 1,
            system_prompt_generated_at: new Date().toISOString(),
            ai_name: "Koya",
            personality: "professional",
            spanish_enabled: false,
            language_mode: "auto",
            greeting: `Thanks for calling ${business.name}, this is Koya, how can I help you?`,
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

            // Create the agent directly via Retell SDK
            const agent = await retellClient.agent.create({
              agent_name: `Koya - ${business.name}`,
              voice_id: "11labs-Rachel",
              language: "en-US",
              response_engine: {
                type: "retell-llm",
                llm_id: process.env.RETELL_LLM_ID || "",
              },
              webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/retell/webhook`,
            });

            // Save agent ID to database
            if (agent?.agent_id) {
              await adminSupabase
                .from("ai_config")
                .update({ retell_agent_id: agent.agent_id })
                .eq("business_id", businessId);
            }
          }
        } catch (agentError) {
          // Don't fail onboarding if agent creation fails
        }
      } else {
        // Prompt generation failed - continue without it
      }
    }

    // =========================================================================
    // Step 3: Mark onboarding complete
    // =========================================================================
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

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch all business data needed for prompt generation
 */
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
  } catch (error) {
    return null;
  }
}
