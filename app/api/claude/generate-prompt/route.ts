/**
 * Koya Caller - Generate Prompt API Route
 * Session 14: Claude API Integration
 * Spec Reference: Part 15, Lines 1758-1916
 *
 * POST /api/claude/generate-prompt
 * Generates system prompts for a business using Claude API
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  generatePrompts,
  buildPromptInputFromDatabase,
  isClaudeConfigured,
} from "@/lib/claude";
import type { GeneratePromptResponse } from "@/lib/claude/types";
import { withAIGenerationRateLimit } from "@/lib/rate-limit/middleware";

// =============================================================================
// POST - Generate prompts for a business
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse<GeneratePromptResponse>> {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

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
        { success: false, error: "Business ID required. Please complete signup first." },
        { status: 400 }
      );
    }

    // Verify user owns this business
    const { data: businessCheck, error: checkError } = await adminSupabase
      .from("businesses")
      .select("user_id")
      .eq("id", businessId)
      .single();

    const business = businessCheck as { user_id: string } | null;

    if (checkError || !business) {
      return NextResponse.json(
        { success: false, error: "Business not found" },
        { status: 404 }
      );
    }

    if (business.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch all required business data (using admin client to bypass RLS)
    const businessData = await fetchBusinessData(adminSupabase, businessId);
    if (!businessData.success) {
      return NextResponse.json(
        { success: false, error: businessData.error },
        { status: 404 }
      );
    }

    // Build prompt input from database records
    const promptInput = buildPromptInputFromDatabase(businessData.data!);

    // Generate prompts
    const result = await generatePrompts(promptInput);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Save prompts to database (using admin client to bypass RLS)
    const saveResult = await savePrompts(
      adminSupabase,
      businessId,
      result.prompts!
    );

    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: saveResult.error },
        { status: 500 }
      );
    }

    // Update Retell agent if configured
    if (saveResult.retellAgentId) {
      await updateRetellAgent(businessId, result.prompts!.englishPrompt);
    }

    return NextResponse.json({
      success: true,
      prompts: result.prompts,
      mock: result.mock,
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check generation status/configuration
// =============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    configured: isClaudeConfigured(),
    model: "claude-sonnet-4-5-20250929",
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

interface FetchResult {
  success: boolean;
  error?: string;

  data?: any;
}

/**
 * Fetch all business data needed for prompt generation
 */
async function fetchBusinessData(

  supabase: any,
  businessId: string
): Promise<FetchResult> {
  try {
    // Fetch business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("name, business_type, address, website, service_area, differentiator, timezone")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return { success: false, error: "Business not found" };
    }

    // Fetch business hours
    const { data: businessHours } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", businessId)
      .order("day_of_week");

    // Fetch services
    const { data: services } = await supabase
      .from("services")
      .select("name, description, duration_minutes, price_cents")
      .eq("business_id", businessId);

    // Fetch FAQs
    const { data: faqs } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("business_id", businessId)
      .order("sort_order");

    // Fetch knowledge
    const { data: knowledge } = await supabase
      .from("knowledge")
      .select("content, never_say")
      .eq("business_id", businessId)
      .single();

    // Fetch AI config
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select(`
        ai_name, personality, 
        greeting, greeting_spanish,
        spanish_enabled, language_mode,
        retell_agent_id, system_prompt_version
      `)
      .eq("business_id", businessId)
      .single();

    // Fetch call settings
    const { data: callSettings } = await supabase
      .from("call_settings")
      .select(`
        transfer_number, 
        transfer_on_request, transfer_on_emergency, transfer_on_upset,
        after_hours_enabled, after_hours_can_book
      `)
      .eq("business_id", businessId)
      .single();

    // Fetch minutes remaining (from businesses table)
    const { data: usage } = await supabase
      .from("businesses")
      .select("minutes_used_this_cycle, minutes_included")
      .eq("id", businessId)
      .single();

    const minutesRemaining = usage
      ? Math.max(0, (usage.minutes_included || 200) - (usage.minutes_used_this_cycle || 0))
      : 200;

    return {
      success: true,
      data: {
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
        minutesRemaining,
        minutesExhausted: minutesRemaining <= 0,
      },
    };
  } catch (_error) {
    return { success: false, error: "Failed to fetch business data" };
  }
}

/**
 * Save generated prompts to database
 * Spec Reference: Lines 1906-1908
 */
async function savePrompts(

  supabase: any,
  businessId: string,

  prompts: any
): Promise<{ success: boolean; error?: string; retellAgentId?: string }> {
  try {
    // Get current version
    const { data: current } = await supabase
      .from("ai_config")
      .select("system_prompt_version, retell_agent_id")
      .eq("business_id", businessId)
      .single();

    const newVersion = (current?.system_prompt_version || 0) + 1;

    // Update ai_config with new prompts
    const { error } = await supabase
      .from("ai_config")
      .update({
        system_prompt: prompts.englishPrompt,
        system_prompt_spanish: prompts.spanishPrompt || null,
        system_prompt_version: newVersion,
        system_prompt_generated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    if (error) {
      return { success: false, error: "Failed to save prompts" };
    }

    return {
      success: true,
      retellAgentId: current?.retell_agent_id,
    };
  } catch (_error) {
    return { success: false, error: "Failed to save prompts" };
  }
}

/**
 * Update Retell agent with new prompt
 * Spec Reference: Lines 1907-1908
 */
async function updateRetellAgent(
  businessId: string,
  systemPrompt: string
): Promise<void> {
  try {
    // Call the Retell agent update API
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    await fetch(`${baseUrl}/api/retell/agent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        systemPrompt,
      }),
    });
  } catch (_error) {
    // Prompt is saved, Retell update can be retried
  }
}

// Export with AI generation rate limiting (10 requests per minute per user)
export const POST = withAIGenerationRateLimit(handlePost);
