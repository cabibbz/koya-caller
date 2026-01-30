/**
 * Koya Caller - Prompt Regeneration Background Jobs
 * Session 21: Background Jobs
 * Spec Reference: Part 15, Lines 1890-1916
 *
 * Handles async prompt regeneration when business info is updated.
 */

import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePrompts, buildPromptInputFromDatabase } from "@/lib/claude";
import { updateAgentAdvancedSettings } from "@/lib/retell";

// =============================================================================
// Process Single Regeneration Request
// =============================================================================

/**
 * Triggered when a business updates their info and needs prompt regeneration
 */
export const processPromptRegeneration = inngest.createFunction(
  {
    id: "prompt-regeneration",
    name: "Process Prompt Regeneration",
    retries: 3,
  },
  { event: "prompt/regeneration.requested" },
  async ({ event, step }) => {
    const { businessId, triggeredBy } = event.data;

    // Step 1: Fetch business data
    const businessData = await step.run("fetch-business-data", async () => {
      const supabase = createServiceClient();
      return await fetchBusinessData(supabase, businessId);
    });

    if (!businessData.success) {
      throw new Error(`Failed to fetch business data: ${businessData.error}`);
    }

    // Step 2: Generate prompts using Claude
    const prompts = await step.run("generate-prompts", async () => {
      const promptInput = buildPromptInputFromDatabase(businessData.data);
      return await generatePrompts(promptInput);
    });

    if (!prompts.success) {
      throw new Error(`Failed to generate prompts: ${prompts.error}`);
    }

    // Step 3: Save prompts to database
    const saveResult = await step.run("save-prompts", async () => {
      const supabase = createServiceClient();
      return await savePrompts(supabase, businessId, prompts.prompts!);
    });

    if (!saveResult.success) {
      throw new Error(`Failed to save prompts: ${saveResult.error}`);
    }

    // Step 4: Update Retell agent if exists
    if (saveResult.retellAgentId) {
      await step.run("update-retell-agent", async () => {
        const supabase = createServiceClient();
        await updateRetellAgent(
          supabase,
          businessId,
          saveResult.retellAgentId!,
          prompts.prompts!.englishPrompt,
          prompts.prompts!.spanishPrompt
        );
      });
    }

    return {
      success: true,
      businessId,
      triggeredBy,
      promptVersion: saveResult.newVersion,
    };
  }
);

// =============================================================================
// Process Regeneration Queue (Scheduled)
// =============================================================================

/**
 * Scheduled job to process any pending items in the queue
 * Runs every 5 minutes
 */
export const processRegenerationQueue = inngest.createFunction(
  {
    id: "prompt-queue-processor",
    name: "Process Prompt Regeneration Queue",
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const supabase = createServiceClient();

    // Get pending queue items
    const queueItems = await step.run("fetch-pending-items", async () => {
      const { data, error } = await (supabase as any)
        .from("prompt_regeneration_queue")
        .select("id, business_id, triggered_by")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw new Error(`Failed to fetch queue: ${error.message}`);
      return (data || []) as Array<{ id: string; business_id: string; triggered_by: string }>;
    });

    if (queueItems.length === 0) {
      return { processed: 0, message: "No pending items" };
    }

    // Process each item by sending events
    for (const item of queueItems) {
      await step.run(`mark-processing-${item.id}`, async () => {
        await (supabase as any)
          .from("prompt_regeneration_queue")
          .update({ status: "processing" })
          .eq("id", item.id);
      });

      // Send event for individual processing
      await step.sendEvent("send-regeneration-event", {
        name: "prompt/regeneration.requested",
        data: {
          businessId: item.business_id,
          triggeredBy: item.triggered_by,
        },
      });

      await step.run(`mark-completed-${item.id}`, async () => {
        await (supabase as any)
          .from("prompt_regeneration_queue")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      });
    }

    return { processed: queueItems.length };
  }
);

// =============================================================================
// Helper Functions
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
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("name, business_type, address, website, service_area, differentiator, timezone, minutes_used_this_cycle, minutes_included")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return { success: false, error: "Business not found" };
    }

    const { data: businessHours } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", businessId)
      .order("day_of_week");

    const { data: services } = await supabase
      .from("services")
      .select("name, description, duration_minutes, price_cents")
      .eq("business_id", businessId)
      .order("sort_order");

    const { data: faqs } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("business_id", businessId)
      .order("sort_order");

    const { data: knowledge } = await supabase
      .from("knowledge")
      .select("content, never_say")
      .eq("business_id", businessId)
      .single();

    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select(`
        ai_name, personality,
        greeting, greeting_spanish,
        spanish_enabled, language_mode,
        retell_agent_id, retell_agent_id_spanish,
        system_prompt_version,
        upsells_enabled,
        bundles_enabled,
        packages_enabled,
        memberships_enabled
      `)
      .eq("business_id", businessId)
      .single();

    const { data: callSettings } = await supabase
      .from("call_settings")
      .select(`
        transfer_number,
        transfer_on_request, transfer_on_emergency, transfer_on_upset,
        after_hours_enabled, after_hours_can_book
      `)
      .eq("business_id", businessId)
      .single();

    // Fetch upsells with service names (only if upsells are enabled)
    let upsells: any[] = [];
    if (aiConfig?.upsells_enabled !== false) {
      const { data: upsellsData } = await supabase
        .from("upsells")
        .select(`
          source_service_id,
          target_service_id,
          discount_percent,
          pitch_message,
          trigger_timing,
          suggest_when_unavailable,
          source_service:services!upsells_source_service_id_fkey(name),
          target_service:services!upsells_target_service_id_fkey(name)
        `)
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(20);
      upsells = upsellsData || [];
    }

    // Fetch bundles with their services (only if bundles are enabled)
    let bundles: any[] = [];
    if (aiConfig?.bundles_enabled !== false) {
      const { data: bundlesData } = await supabase
        .from("bundles")
        .select(`
          name,
          discount_percent,
          pitch_message,
          bundle_services(
            service:services(name)
          )
        `)
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(10);
      bundles = (bundlesData || []).map((b: any) => ({
        ...b,
        services: (b.bundle_services || []).map((bs: any) => bs.service).filter(Boolean),
      }));
    }

    // Fetch packages (only if packages are enabled)
    let packages: any[] = [];
    if (aiConfig?.packages_enabled !== false) {
      const { data: packagesData } = await supabase
        .from("packages")
        .select(`
          name,
          session_count,
          discount_percent,
          pitch_message,
          min_visits_to_pitch,
          service:services(name)
        `)
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(15);
      packages = packagesData || [];
    }

    // Fetch memberships (only if memberships are enabled)
    let memberships: any[] = [];
    if (aiConfig?.memberships_enabled !== false) {
      const { data: membershipsData } = await supabase
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
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(5);
      memberships = membershipsData || [];
    }

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
        upsells,
        bundles,
        packages,
        memberships,
        minutesRemaining,
        minutesExhausted: minutesRemaining <= 0,
      },
    };
  } catch {
    return { success: false, error: "Failed to fetch business data" };
  }
}

async function savePrompts(
  supabase: any,
  businessId: string,
  prompts: any
): Promise<{ success: boolean; error?: string; retellAgentId?: string; newVersion?: number }> {
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
      newVersion,
    };
  } catch (_error) {
    return { success: false, error: "Failed to save prompts" };
  }
}

async function updateRetellAgent(
  supabase: any,
  businessId: string,
  agentId: string,
  englishPrompt: string,
  _spanishPrompt?: string
): Promise<void> {
  try {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;

    if (!RETELL_API_KEY) {
      return;
    }

    const agentResponse = await fetch(
      `https://api.retellai.com/get-agent/${agentId}`,
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
    const llmId = agentData.response_engine?.llm_id;

    if (!llmId) {
      return;
    }

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
      return;
    }

    // Sync advanced settings from database to Retell agent
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("retell_agent_version, boosted_keywords, analysis_summary_prompt, analysis_model, fallback_voice_ids")
      .eq("business_id", businessId)
      .single();

    const { data: callSettings } = await supabase
      .from("call_settings")
      .select(`
        voicemail_detection_enabled, voicemail_message, voicemail_detection_timeout_ms,
        reminder_trigger_ms, reminder_max_count, end_call_after_silence_ms,
        dtmf_enabled, dtmf_digit_limit, dtmf_termination_key, dtmf_timeout_ms,
        denoising_mode, pii_redaction_enabled, pii_categories
      `)
      .eq("business_id", businessId)
      .single();

    // Update advanced Retell agent settings
    if (callSettings || aiConfig?.boosted_keywords?.length) {
      await updateAgentAdvancedSettings(agentId, {
        voicemailDetection: callSettings ? {
          enabled: callSettings.voicemail_detection_enabled ?? false,
          message: callSettings.voicemail_message || undefined,
          timeoutMs: callSettings.voicemail_detection_timeout_ms || 30000,
        } : undefined,
        silenceHandling: callSettings ? {
          reminderTriggerMs: callSettings.reminder_trigger_ms || 10000,
          reminderMaxCount: callSettings.reminder_max_count ?? 2,
          endCallAfterSilenceMs: callSettings.end_call_after_silence_ms || 30000,
        } : undefined,
        dtmf: callSettings ? {
          enabled: callSettings.dtmf_enabled ?? false,
          digitLimit: callSettings.dtmf_digit_limit || 10,
          terminationKey: callSettings.dtmf_termination_key || "#",
          timeoutMs: callSettings.dtmf_timeout_ms || 5000,
        } : undefined,
        denoisingMode: callSettings?.denoising_mode || "noise-cancellation",
        boostedKeywords: aiConfig?.boosted_keywords || [],
        summaryConfig: aiConfig?.analysis_summary_prompt ? {
          prompt: aiConfig.analysis_summary_prompt,
          model: aiConfig.analysis_model || "gpt-4.1-mini",
        } : undefined,
        piiConfig: callSettings?.pii_redaction_enabled ? {
          enabled: true,
          categories: callSettings.pii_categories || ["ssn", "credit_card"],
        } : undefined,
        fallbackVoices: aiConfig?.fallback_voice_ids || [],
      });
    }

    await supabase
      .from("ai_config")
      .update({
        retell_agent_version: (aiConfig?.retell_agent_version || 0) + 1,
      })
      .eq("business_id", businessId);
  } catch {
    // Error handled silently
  }
}
