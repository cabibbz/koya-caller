/**
 * Koya Caller - Process Regeneration Queue API Route
 * Session 14: Claude API Integration
 * Spec Reference: Part 15, Lines 1890-1916
 *
 * POST /api/claude/process-queue
 * Processes pending items in the prompt_regeneration_queue
 *
 * This endpoint is designed to be called by:
 * 1. A cron job (e.g., Vercel Cron)
 * 2. Manually after business updates
 * 3. A background worker
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generatePrompts,
  buildPromptInputFromDatabase,
} from "@/lib/claude";
import type { ProcessQueueResponse } from "@/lib/claude/types";

// =============================================================================
// Configuration
// =============================================================================

const MAX_BATCH_SIZE = 10; // Process up to 10 items per request
const CRON_SECRET = process.env.CRON_SECRET;

// Type for queue items from database
interface QueueItem {
  id: string;
  business_id: string;
  triggered_by: string;
}

// =============================================================================
// POST - Process queue items
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ProcessQueueResponse>> {
  try {
    // Verify cron secret if configured (for production security)
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, processed: 0, failed: 0, errors: [{ businessId: "", error: "Unauthorized" }] },
          { status: 401 }
        );
      }
    }

    const supabase = createServiceClient();

    // Fetch pending queue items
    const { data: queueItems, error: fetchError } = await supabase
      .from("prompt_regeneration_queue")
      .select("id, business_id, triggered_by")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (fetchError) {
      return NextResponse.json(
        { success: false, processed: 0, failed: 0, errors: [{ businessId: "", error: "Failed to fetch queue" }] },
        { status: 500 }
      );
    }

    // Cast to proper type
    const items = (queueItems || []) as QueueItem[];

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
      });
    }

    // Process each queue item
    const results = await Promise.allSettled(
      items.map((item) => processQueueItem(supabase, item))
    );

    // Count successes and failures
    let processed = 0;
    let failed = 0;
    const errors: { businessId: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        processed++;
      } else {
        failed++;
        const errorMessage =
          result.status === "rejected"
            ? result.reason?.message || "Unknown error"
            : result.value.error || "Unknown error";
        errors.push({
          businessId: items[index].business_id,
          error: errorMessage,
        });
      }
    });

    return NextResponse.json({
      success: failed === 0,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, processed: 0, failed: 0, errors: [{ businessId: "", error: "Internal server error" }] },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check queue status
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createServiceClient();

    // Get queue counts by status
    const { data: counts } = await supabase
      .from("prompt_regeneration_queue")
      .select("status")
      .in("status", ["pending", "processing", "completed", "failed"]);

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    // Cast to proper type
    const items = (counts || []) as Array<{ status: string }>;
    items.forEach((item) => {
      if (item.status in statusCounts) {
        statusCounts[item.status as keyof typeof statusCounts]++;
      }
    });

    return NextResponse.json({
      queue: statusCounts,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Queue Item Processing
// =============================================================================

interface ProcessResult {
  success: boolean;
  error?: string;
}

/**
 * Process a single queue item
 * Spec Reference: Lines 1900-1909
 */
async function processQueueItem(

  supabase: any,
  item: { id: string; business_id: string; triggered_by: string }
): Promise<ProcessResult> {
  const { id: queueId, business_id: businessId } = item;

  try {
    // Mark as processing
    // @ts-ignore - Supabase type inference issue
    await supabase
      .from("prompt_regeneration_queue")
      .update({ status: "processing" })
      .eq("id", queueId);

    // Fetch business data
    const businessData = await fetchBusinessData(supabase, businessId);
    if (!businessData.success) {
      await markQueueFailed(supabase, queueId, businessData.error!);
      return { success: false, error: businessData.error };
    }

    // Build prompt input
    const promptInput = buildPromptInputFromDatabase(businessData.data);

    // Generate prompts using Claude
    const result = await generatePrompts(promptInput);
    if (!result.success) {
      await markQueueFailed(supabase, queueId, result.error!);
      return { success: false, error: result.error };
    }

    // Save prompts to ai_config
    const saveResult = await savePrompts(supabase, businessId, result.prompts!);
    if (!saveResult.success) {
      await markQueueFailed(supabase, queueId, saveResult.error!);
      return { success: false, error: saveResult.error };
    }

    // Update Retell agent if exists
    if (saveResult.retellAgentId) {
      await updateRetellAgent(
        supabase,
        businessId,
        saveResult.retellAgentId,
        result.prompts!.englishPrompt,
        result.prompts!.spanishPrompt
      );
    }

    // Mark as completed
    // @ts-ignore - Supabase type inference issue
    await supabase
      .from("prompt_regeneration_queue")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", queueId);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await markQueueFailed(supabase, queueId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Mark queue item as failed
 */
async function markQueueFailed(

  supabase: any,
  queueId: string,
  errorMessage: string
): Promise<void> {
  // @ts-ignore - Supabase type inference issue
  await supabase
    .from("prompt_regeneration_queue")
    .update({
      status: "failed",
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

// =============================================================================
// Data Fetching (reused from generate-prompt route)
// =============================================================================

interface FetchResult {
  success: boolean;
  error?: string;

  data?: any;
}

async function fetchBusinessData(

  supabase: any,
  businessId: string
): Promise<FetchResult> {
  try {
    // Fetch business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("name, type, address, website, service_area, differentiator, timezone, minutes_used, minutes_limit")
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
      .select("name, description, duration_minutes, price")
      .eq("business_id", businessId)
      .eq("active", true);

    // Fetch FAQs
    const { data: faqs } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("display_order");

    // Fetch knowledge
    const { data: knowledge } = await supabase
      .from("knowledge")
      .select("additional_info, never_say")
      .eq("business_id", businessId)
      .single();

    // Fetch AI config
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select(`
        ai_name, personality, 
        greeting, greeting_spanish,
        spanish_enabled, language_mode,
        retell_agent_id, retell_agent_id_spanish,
        system_prompt_version
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

    const minutesRemaining = Math.max(
      0,
      (business.minutes_limit || 200) - (business.minutes_used || 0)
    );

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
  } catch (error) {
    return { success: false, error: "Failed to fetch business data" };
  }
}

/**
 * Save generated prompts to database
 */
async function savePrompts(

  supabase: any,
  businessId: string,

  prompts: any
): Promise<{ success: boolean; error?: string; retellAgentId?: string }> {
  try {
    const { data: current } = await supabase
      .from("ai_config")
      .select("system_prompt_version, retell_agent_id")
      .eq("business_id", businessId)
      .single();

    const newVersion = (current?.system_prompt_version || 0) + 1;

    // @ts-ignore - Supabase type inference issue
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
  } catch (error) {
    return { success: false, error: "Failed to save prompts" };
  }
}

/**
 * Update Retell agent with new system prompt
 * Spec Reference: Lines 1907-1908
 */
async function updateRetellAgent(

  supabase: any,
  businessId: string,
  agentId: string,
  englishPrompt: string,
  spanishPrompt?: string
): Promise<void> {
  try {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;

    if (!RETELL_API_KEY) {
      return;
    }

    // Update the Retell LLM with new prompt
    // First, get the LLM ID from the agent
    const agentResponse = await fetch(
      `https://api.retellai.com/v2/agent/${agentId}`,
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
      }
    );

    if (!agentResponse.ok) {
      return;
    }

    const agentData = await agentResponse.json();
    const llmId = agentData.llm_id;

    if (!llmId) {
      return;
    }

    // Update the LLM prompt
    const updateResponse = await fetch(
      `https://api.retellai.com/v2/llm/${llmId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          general_prompt: englishPrompt,
        }),
      }
    );

    if (!updateResponse.ok) {
      return;
    }

    // Increment Retell agent version in database
    const { data: config } = await supabase
      .from("ai_config")
      .select("retell_agent_version")
      .eq("business_id", businessId)
      .single();

    // @ts-ignore - Supabase type inference issue
    await supabase
      .from("ai_config")
      .update({
        retell_agent_version: (config?.retell_agent_version || 0) + 1,
      })
      .eq("business_id", businessId);
  } catch (error) {
    // Error handled silently
  }
}
