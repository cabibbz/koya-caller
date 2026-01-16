/**
 * Trigger prompt regeneration with Inngest fallback
 *
 * When Inngest is configured, uses background jobs.
 * When not configured, falls back to direct API call.
 */

import { inngest } from "./client";
import { logError } from "@/lib/logging";

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;

/**
 * Trigger prompt regeneration for a business
 * Falls back to direct processing if Inngest isn't configured
 */
export async function triggerPromptRegeneration(
  businessId: string,
  triggeredBy: string
): Promise<{ success: boolean; method: "inngest" | "direct"; error?: string }> {
  // If Inngest is configured, use it
  if (INNGEST_EVENT_KEY) {
    try {
      await inngest.send({
        name: "prompt/regeneration.requested",
        data: { businessId, triggeredBy },
      });
      return { success: true, method: "inngest" };
    } catch (error) {
      logError("Regeneration", error);
      // Fall through to direct processing
    }
  }

  // Fallback: Direct processing via process-queue endpoint

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Call process-queue with businessId for direct processing mode
    const response = await fetch(`${baseUrl}/api/claude/process-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-call": "true",
      },
      body: JSON.stringify({ businessId, triggeredBy }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        method: "direct",
        error: errorData.errors?.[0]?.error || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();
    if (!result.success) {
      return {
        success: false,
        method: "direct",
        error: result.errors?.[0]?.error || "Regeneration failed",
      };
    }

    return { success: true, method: "direct" };
  } catch (error) {
    return {
      success: false,
      method: "direct",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if Inngest is configured
 */
export function isInngestConfigured(): boolean {
  return !!INNGEST_EVENT_KEY;
}
