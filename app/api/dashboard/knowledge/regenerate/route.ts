/**
 * Prompt Regeneration Trigger API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Line 720
 *
 * Triggers automatic prompt regeneration and Retell agent update
 * when knowledge is modified.
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { queuePromptRegeneration } from "@/lib/claude/queue";
import type { RegenerationTrigger } from "@/lib/claude/types";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// POST Handler - Trigger prompt regeneration
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { businessId, triggerType } = body;

    // Verify the business ID matches (security check)
    if (businessId && businessId !== business.id) {
      return success({ success: false, message: "Business ID mismatch" });
    }

    // Valid trigger types
    const validTriggers: RegenerationTrigger[] = [
      "services_update",
      "faqs_update",
      "knowledge_update",
      "settings_update",
      "language_update",
      "offer_settings_update",
    ];

    const trigger = validTriggers.includes(triggerType)
      ? triggerType as RegenerationTrigger
      : "settings_update";

    // Queue the regeneration
    const result = await queuePromptRegeneration(supabase, business.id, trigger);

    if (!result.success) {
      // Don't fail the request - regeneration is best-effort
      return success({
        queued: false,
        message: "Save successful, regeneration will be retried"
      });
    }

    // Optionally trigger immediate processing in development
    if (process.env.NODE_ENV === "development") {
      // In dev, we might want immediate regeneration
      // For production, a cron job handles the queue
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await fetch(`${baseUrl}/api/claude/process-queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (_err) {
        // Ignore errors - queue processing is async
      }
    }

    return success({ queued: true });
  } catch (error) {
    logError("Knowledge Regenerate POST", error);
    return success({ queued: false, message: "Regeneration failed" });
  }
}

export const POST = withAuth(handlePost);
