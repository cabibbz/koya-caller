/**
 * Koya Caller - Prompt Regeneration Queue Helpers
 * Session 14: Claude API Integration
 * Spec Reference: Part 15, Lines 1890-1916
 *
 * Helpers for adding items to the regeneration queue and triggering processing.
 */

import type { RegenerationTrigger } from "./types";

// =============================================================================
// Queue Management Functions
// =============================================================================

/**
 * Add an item to the prompt regeneration queue
 * Spec Reference: Lines 1901
 *
 * @param supabase - Supabase client
 * @param businessId - Business ID to regenerate prompt for
 * @param triggeredBy - What triggered the regeneration
 */
export async function queuePromptRegeneration(

  supabase: any,
  businessId: string,
  triggeredBy: RegenerationTrigger
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if there's already a pending item for this business
    const { data: existing } = await supabase
      .from("prompt_regeneration_queue")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .single();

    // If there's already a pending item, just return success
    // (no need to duplicate queue items)
    if (existing) {
      return { success: true };
    }

    // Add to queue
    const { error } = await supabase.from("prompt_regeneration_queue").insert({
      business_id: businessId,
      triggered_by: triggeredBy,
      status: "pending",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger immediate prompt regeneration (for onboarding completion)
 * This generates prompts synchronously rather than queuing.
 *
 * @param businessId - Business ID
 * @returns Promise with result
 */
export async function triggerImmediateRegeneration(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/claude/generate-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Generation failed" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Trigger queue processing (for cron or manual invocation)
 */
export async function processRegenerationQueue(): Promise<{
  success: boolean;
  processed?: number;
  failed?: number;
  error?: string;
}> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const cronSecret = process.env.CRON_SECRET;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(`${baseUrl}/api/claude/process-queue`, {
      method: "POST",
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Processing failed" };
    }

    return {
      success: true,
      processed: data.processed,
      failed: data.failed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Trigger Detection Helpers
// =============================================================================

/**
 * Determine the trigger type based on what was updated
 */
export function getTriggerType(
  updatedTable: "services" | "faqs" | "knowledge" | "ai_config" | "call_settings" | "language"
): RegenerationTrigger {
  switch (updatedTable) {
    case "services":
      return "services_update";
    case "faqs":
      return "faqs_update";
    case "knowledge":
      return "knowledge_update";
    case "ai_config":
    case "call_settings":
      return "settings_update";
    case "language":
      return "language_update";
    default:
      return "settings_update";
  }
}
