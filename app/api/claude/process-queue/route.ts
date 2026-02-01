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
import { logError } from "@/lib/logging";

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
    // Skip auth check for internal calls (localhost with businessId)
    const body = await request.json().catch(() => ({}));
    const directBusinessId = body.businessId;
    const isInternalCall = directBusinessId &&
      (request.headers.get("host")?.includes("localhost") ||
       request.headers.get("x-internal-call") === "true");

    if (CRON_SECRET && !isInternalCall) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, processed: 0, failed: 0, errors: [{ businessId: "", error: "Unauthorized" }] },
          { status: 401 }
        );
      }
    }

    const supabase = createServiceClient();

    // Direct business processing mode (fallback when Inngest not configured)
    if (directBusinessId) {
      const result = await processBusinessDirectly(supabase, directBusinessId, body.triggeredBy || "direct");

      return NextResponse.json({
        success: result.success,
        processed: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        errors: result.error ? [{ businessId: directBusinessId, error: result.error }] : undefined,
      });
    }

    // Normal queue processing mode
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
    logError("Process Queue", error);
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
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Direct Business Processing (Fallback Mode)
// =============================================================================

/**
 * Process a business directly without going through the queue
 * Used when Inngest is not configured
 */
async function processBusinessDirectly(
  supabase: any,
  businessId: string,
  _triggeredBy: string
): Promise<ProcessResult> {
  try {
    // Fetch business data
    const businessData = await fetchBusinessData(supabase, businessId);
    if (!businessData.success) {
      return { success: false, error: businessData.error };
    }

    // Build prompt input
    const promptInput = buildPromptInputFromDatabase(businessData.data);

    // Generate prompts using Claude
    const result = await generatePrompts(promptInput);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Save prompts to ai_config
    const saveResult = await savePrompts(supabase, businessId, result.prompts!);
    if (!saveResult.success) {
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

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError("Process Queue Direct", error);
    return { success: false, error: errorMessage };
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
      .select("name, business_type, address, website, service_area, differentiator, timezone, minutes_used_this_cycle, minutes_included")
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

    // Fetch upsells with service relations
    const { data: upsells } = await supabase
      .from("upsells")
      .select(`
        id,
        discount_percent,
        pitch_message,
        trigger_timing,
        suggest_when_unavailable,
        source_service:services!source_service_id(name),
        target_service:services!target_service_id(name)
      `)
      .eq("business_id", businessId);

    // Fetch bundles
    const { data: bundles } = await supabase
      .from("bundles")
      .select("id, name, discount_percent, pitch_message")
      .eq("business_id", businessId);

    // Fetch bundle services for each bundle
    let bundlesWithServices: Array<{
      name: string;
      discount_percent: number;
      pitch_message: string | null;
      services: Array<{ name: string }>;
    }> = [];

    if (bundles && bundles.length > 0) {
      bundlesWithServices = await Promise.all(
        (bundles as Array<{ id: string; name: string; discount_percent: number; pitch_message: string | null }>).map(async (b) => {
          const { data: bundleServices } = await supabase
            .from("bundle_services")
            .select("service:services(name)")
            .eq("bundle_id", b.id);
          return {
            name: b.name,
            discount_percent: b.discount_percent,
            pitch_message: b.pitch_message,
            services: (bundleServices || []).map((bs: any) => bs.service).filter(Boolean),
          };
        })
      );
    }

    // Fetch packages
    const { data: packages } = await supabase
      .from("packages")
      .select(`
        name,
        session_count,
        discount_percent,
        pitch_message,
        min_visits_to_pitch,
        service:services(name)
      `)
      .eq("business_id", businessId);

    // Fetch memberships
    const { data: memberships } = await supabase
      .from("memberships")
      .select(`
        name,
        price_cents,
        billing_period,
        benefits,
        pitch_message,
        pitch_after_booking_amount_cents,
        pitch_after_visit_count
      `)
      .eq("business_id", businessId);

    const minutesRemaining = Math.max(
      0,
      (business.minutes_included || 200) - (business.minutes_used_this_cycle || 0)
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
        // Upselling data for prompt generation
        upsells: upsells || [],
        bundles: bundlesWithServices,
        packages: packages || [],
        memberships: memberships || [],
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
 * Update Retell agent with new system prompt
 * Spec Reference: Lines 1907-1908
 */
async function updateRetellAgent(
  supabase: any,
  businessId: string,
  agentId: string,
  englishPrompt: string,
  _spanishPrompt?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;

    if (!RETELL_API_KEY) {
      const errorMsg = "RETELL_API_KEY not configured";
      await logToSystemLogs(supabase, businessId, "retell_sync_failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    // Update the Retell LLM with new prompt
    // First, get the LLM ID from the agent
    const agentResponse = await fetch(
      `https://api.retellai.com/get-agent/${agentId}`,
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
      }
    );

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      const errorMsg = `Failed to fetch Retell agent: ${agentResponse.status} - ${errorText}`;
      await logToSystemLogs(supabase, businessId, "retell_sync_failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    const agentData = await agentResponse.json();
    const llmId = agentData.response_engine?.llm_id;

    if (!llmId) {
      const errorMsg = "Retell agent has no LLM ID configured";
      await logToSystemLogs(supabase, businessId, "retell_sync_failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    // Update the LLM prompt
    const updateResponse = await fetch(
      `https://api.retellai.com/update-retell-llm/${llmId}`,
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
      const errorText = await updateResponse.text();
      const errorMsg = `Failed to update Retell LLM: ${updateResponse.status} - ${errorText}`;
      await logToSystemLogs(supabase, businessId, "retell_sync_failed", errorMsg);
      return { success: false, error: errorMsg };
    }

    // Increment Retell agent version in database
    const { data: config } = await supabase
      .from("ai_config")
      .select("retell_agent_version")
      .eq("business_id", businessId)
      .single();

    await supabase
      .from("ai_config")
      .update({
        retell_agent_version: (config?.retell_agent_version || 0) + 1,
        retell_synced_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    await logToSystemLogs(supabase, businessId, "retell_sync_success", "Prompt synced to Retell agent");
    return { success: true };
  } catch (error) {
    const errorMsg = `Retell sync exception: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError("Retell Sync", error);
    await logToSystemLogs(supabase, businessId, "retell_sync_failed", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Log to system_logs table for visibility
 */
async function logToSystemLogs(
  supabase: any,
  businessId: string,
  eventType: string,
  message: string
): Promise<void> {
  try {
    await supabase.from("system_logs").insert({
      business_id: businessId,
      event_type: eventType,
      message,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Don't fail if logging fails
  }
}
