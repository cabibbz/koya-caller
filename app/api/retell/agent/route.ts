/**
 * Koya Caller - Retell Agent Management API
 * Session 13: Retell.ai Integration
 * Spec Reference: Part 11, Lines 1379-1393
 *
 * Handles agent creation and updates during onboarding and settings changes.
 * Creates Retell LLM + Agent configurations.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createAgent,
  updateAgent,
  deleteAgent,
  isRetellConfigured,
} from "@/lib/retell";
import {
  buildSystemPromptTemplate,
  DEFAULT_GREETINGS,
} from "@/lib/retell/functions";

// =============================================================================
// Types
// =============================================================================

interface CreateAgentRequest {
  businessId: string;
  voiceId: string;
  personality: "professional" | "friendly" | "casual";
  spanishEnabled: boolean;
  languageMode: "auto" | "ask" | "spanish_default";
  customGreeting?: string;
  customGreetingSpanish?: string;
  systemPrompt?: string;
  systemPromptSpanish?: string;
}

interface UpdateAgentRequest {
  businessId: string;
  voiceId?: string;
  personality?: "professional" | "friendly" | "casual";
  spanishEnabled?: boolean;
  languageMode?: "auto" | "ask" | "spanish_default";
  customGreeting?: string;
  customGreetingSpanish?: string;
  systemPrompt?: string;
  systemPromptSpanish?: string;
}

// =============================================================================
// POST - Create Agent
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: Partial<CreateAgentRequest> = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { error: "Missing required field: businessId" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: business, error: bizError } = await adminSupabase
      .from("businesses")
      .select("id, user_id, name")
      .eq("id", body.businessId)
      .single();

    if (bizError || !business) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    const businessData = business as { id: string; user_id: string; name: string };
    if (businessData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    // Fetch existing AI config to get voice settings and generated prompt
    const { data: existingConfig } = await adminSupabase
      .from("ai_config")
      .select("*")
      .eq("business_id", body.businessId)
      .single();

    const configData = existingConfig as Record<string, unknown> | null;

    // Use provided values or fall back to database values
    const voiceId = body.voiceId || (configData?.voice_id as string) || "11labs-Grace";
    const personality = body.personality || (configData?.personality as "professional" | "friendly" | "casual") || "professional";
    const spanishEnabled = body.spanishEnabled ?? (configData?.spanish_enabled as boolean) ?? false;
    const languageMode = body.languageMode || (configData?.language_mode as "auto" | "ask" | "spanish_default") || "auto";
    const aiName = (configData?.ai_name as string) || "Koya";

    // IMPORTANT: Use the Claude-generated system prompt from database
    const systemPrompt = body.systemPrompt || (configData?.system_prompt as string) || null;
    const systemPromptSpanish = body.systemPromptSpanish || (configData?.system_prompt_spanish as string) || null;

    if (!isRetellConfigured()) {
      const mockAgentId = `agent_mock_${Date.now()}`;

      await (adminSupabase.from("ai_config") as any)
        .upsert({
          business_id: body.businessId,
          voice_id: voiceId,
          personality: personality,
          spanish_enabled: spanishEnabled,
          language_mode: languageMode,
          greeting: body.customGreeting || (configData?.greeting as string) || DEFAULT_GREETINGS.english[personality],
          greeting_spanish: spanishEnabled
            ? body.customGreetingSpanish || (configData?.greeting_spanish as string) || DEFAULT_GREETINGS.spanish[personality]
            : null,
          retell_agent_id: mockAgentId,
          retell_agent_version: ((configData?.retell_agent_version as number) || 0) + 1,
        }, { onConflict: "business_id" });

      return NextResponse.json({
        success: true,
        agentId: mockAgentId,
        mock: true,
        message: "Agent created in mock mode (Retell API key not configured)",
      });
    }

    const { data: services } = await adminSupabase
      .from("services")
      .select("name, duration_minutes")
      .eq("business_id", body.businessId)
      .eq("is_bookable", true);

    const { data: faqs } = await adminSupabase
      .from("faqs")
      .select("question, answer")
      .eq("business_id", body.businessId)
      .order("sort_order", { ascending: true });

    const { data: businessHours } = await adminSupabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", body.businessId);

    const { data: callSettings } = await adminSupabase
      .from("call_settings")
      .select("transfer_number, transfer_on_request")
      .eq("business_id", body.businessId)
      .single();

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const hoursArray = (businessHours || []) as Array<{
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }>;
    const hoursString = hoursArray
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map(h => {
        if (h.is_closed || !h.open_time) return `${days[h.day_of_week]}: Closed`;
        return `${days[h.day_of_week]}: ${h.open_time} - ${h.close_time}`;
      })
      .join("\n") || "Hours not set";
    
    const callSettingsData = callSettings as { transfer_number?: string; transfer_on_request?: boolean } | null;
    const servicesArray = (services || []) as Array<{ name: string; duration_minutes: number }>;
    const faqsArray = (faqs || []) as Array<{ question: string; answer: string }>;

    // Use Claude-generated prompt if available, otherwise build a template
    const finalSystemPrompt = systemPrompt || buildSystemPromptTemplate({
      businessName: businessData.name,
      aiName,
      personality,
      spanishEnabled,
      languageMode,
      services: servicesArray.map(s => s.name),
      faqs: faqsArray,
      businessHours: hoursString,
      canBook: true,
      canTransfer: !!callSettingsData?.transfer_number && !!callSettingsData?.transfer_on_request,
    });

    const greeting = body.customGreeting || (configData?.greeting as string) || DEFAULT_GREETINGS.english[personality];
    const greetingSpanish = spanishEnabled
      ? body.customGreetingSpanish || (configData?.greeting_spanish as string) || DEFAULT_GREETINGS.spanish[personality]
      : undefined;

    // Delete existing agent if one exists
    if (configData?.retell_agent_id) {
      await deleteAgent(configData.retell_agent_id as string);
    }

    // Create main (English or multilingual) agent
    const agent = await createAgent({
      voiceId,
      language: spanishEnabled ? "multi" : "en",
      personality,
      businessName: businessData.name,
      aiName,
      greeting,
      greetingSpanish,
      systemPrompt: finalSystemPrompt,
      systemPromptSpanish: systemPromptSpanish || undefined,
      spanishEnabled,
      languageMode,
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Failed to create Retell agent" },
        { status: 500 }
      );
    }

    // Create dedicated Spanish agent if Spanish is enabled
    // This provides better Spanish handling than multilingual mode
    let spanishAgentId: string | null = null;
    if (spanishEnabled && greetingSpanish && systemPromptSpanish) {
      // Delete existing Spanish agent if one exists
      if (configData?.retell_agent_id_spanish) {
        await deleteAgent(configData.retell_agent_id_spanish as string);
      }

      const spanishAgent = await createAgent({
        voiceId, // Use same voice - ElevenLabs multilingual handles Spanish
        language: "es", // Spanish-only agent
        personality,
        businessName: businessData.name,
        aiName,
        greeting: greetingSpanish, // Use Spanish greeting only
        systemPrompt: systemPromptSpanish, // Use Spanish system prompt only
        spanishEnabled: true,
        languageMode: "spanish_default",
      });

      if (spanishAgent) {
        spanishAgentId = spanishAgent.agent_id;
      }
    }

    await (adminSupabase.from("ai_config") as any)
      .upsert({
        business_id: body.businessId,
        voice_id: voiceId,
        personality,
        spanish_enabled: spanishEnabled,
        language_mode: languageMode,
        greeting,
        greeting_spanish: greetingSpanish || null,
        retell_agent_id: agent.agent_id,
        retell_agent_id_spanish: spanishAgentId,
        retell_agent_version: ((configData?.retell_agent_version as number) || 0) + 1,
      }, { onConflict: "business_id" });

    return NextResponse.json({
      success: true,
      agentId: agent.agent_id,
      spanishAgentId,
      llmId: agent.llm_id,
    });

  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Agent
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: UpdateAgentRequest = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { error: "Missing required field: businessId" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: business } = await adminSupabase
      .from("businesses")
      .select("id, user_id, name")
      .eq("id", body.businessId)
      .single();

    const businessData = business as { id: string; user_id: string; name: string } | null;
    if (!businessData || businessData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("*")
      .eq("business_id", body.businessId)
      .single();

    const configData = aiConfig as Record<string, unknown> | null;
    if (!configData?.retell_agent_id) {
      return NextResponse.json(
        { error: "No agent exists for this business. Create one first." },
        { status: 400 }
      );
    }

    if (isRetellConfigured()) {
      const _success = await updateAgent(configData.retell_agent_id as string, {
        voiceId: body.voiceId || configData.voice_id as string,
        personality: body.personality || configData.personality as "professional" | "friendly" | "casual",
        greeting: body.customGreeting || configData.greeting as string,
        greetingSpanish: body.customGreetingSpanish || configData.greeting_spanish as string,
        systemPrompt: body.systemPrompt || configData.system_prompt as string,
        systemPromptSpanish: body.systemPromptSpanish || configData.system_prompt_spanish as string,
        spanishEnabled: body.spanishEnabled ?? configData.spanish_enabled as boolean,
        languageMode: body.languageMode || configData.language_mode as "auto" | "ask" | "spanish_default",
        language: (body.spanishEnabled ?? configData.spanish_enabled) ? "multi" : "en",
        businessName: businessData.name,
        aiName: configData.ai_name as string,
      });

    }

    const updates: Record<string, unknown> = {};
    if (body.voiceId) updates.voice_id = body.voiceId;
    if (body.personality) updates.personality = body.personality;
    if (body.spanishEnabled !== undefined) updates.spanish_enabled = body.spanishEnabled;
    if (body.languageMode) updates.language_mode = body.languageMode;
    if (body.customGreeting) updates.greeting = body.customGreeting;
    if (body.customGreetingSpanish) updates.greeting_spanish = body.customGreetingSpanish;
    if (body.systemPrompt) {
      updates.system_prompt = body.systemPrompt;
      updates.system_prompt_version = ((configData.system_prompt_version as number) || 0) + 1;
      updates.system_prompt_generated_at = new Date().toISOString();
    }
    if (body.systemPromptSpanish) {
      updates.system_prompt_spanish = body.systemPromptSpanish;
    }

    updates.retell_agent_version = ((configData.retell_agent_version as number) || 0) + 1;
    updates.updated_at = new Date().toISOString();

    await (adminSupabase.from("ai_config") as any)
      .update(updates)
      .eq("business_id", body.businessId);

    return NextResponse.json({
      success: true,
      agentId: configData.retell_agent_id,
    });

  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Agent
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing required parameter: businessId" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: business } = await adminSupabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId)
      .single();

    const businessData = business as { id: string; user_id: string } | null;
    if (!businessData || businessData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id")
      .eq("business_id", businessId)
      .single();

    const configData = aiConfig as { retell_agent_id?: string } | null;
    if (configData?.retell_agent_id && isRetellConfigured()) {
      await deleteAgent(configData.retell_agent_id);
    }

    await (adminSupabase.from("ai_config") as any)
      .update({
        retell_agent_id: null,
        retell_agent_id_spanish: null,
      })
      .eq("business_id", businessId);

    return NextResponse.json({
      success: true,
      message: "Agent deleted successfully",
    });

  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get Agent Status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing required parameter: businessId" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: business } = await adminSupabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId)
      .single();

    const businessData = business as { id: string; user_id: string } | null;
    if (!businessData || businessData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Business not found or access denied" },
        { status: 403 }
      );
    }

    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("*")
      .eq("business_id", businessId)
      .single();

    const configData = aiConfig as Record<string, unknown> | null;

    return NextResponse.json({
      configured: !!configData?.retell_agent_id,
      retellConfigured: isRetellConfigured(),
      agentId: configData?.retell_agent_id || null,
      voiceId: configData?.voice_id || null,
      personality: configData?.personality || null,
      spanishEnabled: configData?.spanish_enabled || false,
      languageMode: configData?.language_mode || null,
      systemPromptVersion: configData?.system_prompt_version || 0,
      agentVersion: configData?.retell_agent_version || 0,
    });

  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to get agent status" },
      { status: 500 }
    );
  }
}
