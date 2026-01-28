/**
 * Additional Knowledge API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 743-746
 *
 * PUT: Update additional knowledge content
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { inngest } from "@/lib/inngest/client";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// PUT Handler - Update additional knowledge content
// =============================================================================

// Maximum lengths for knowledge fields
const MAX_CONTENT_LENGTH = 50000; // 50KB for main knowledge content
const MAX_NEVER_SAY_LENGTH = 10000; // 10KB for never-say instructions

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { knowledge } = body;

    if (!knowledge) {
      return errors.badRequest("Knowledge data required");
    }

    // Validate content length
    if (knowledge.content && typeof knowledge.content === "string" && knowledge.content.length > MAX_CONTENT_LENGTH) {
      return errors.badRequest(`Knowledge content must be ${MAX_CONTENT_LENGTH} characters or less`);
    }
    if (knowledge.never_say && typeof knowledge.never_say === "string" && knowledge.never_say.length > MAX_NEVER_SAY_LENGTH) {
      return errors.badRequest(`Never-say content must be ${MAX_NEVER_SAY_LENGTH} characters or less`);
    }

    // Upsert knowledge (create or update)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (supabase as any)
      .from("knowledge")
      .upsert(
        {
          business_id: business.id,
          content: typeof knowledge.content === "string" ? knowledge.content : null,
          never_say: typeof knowledge.never_say === "string" ? knowledge.never_say : null,
        },
        { onConflict: "business_id" }
      );

    if (upsertError) {
      logError("Knowledge Additional PUT", upsertError);
      return errors.internalError("Failed to save knowledge");
    }

    // Trigger Retell AI sync via prompt regeneration
    await inngest.send({
      name: "prompt/regeneration.requested",
      data: {
        businessId: business.id,
        triggeredBy: "knowledge_update",
      },
    });

    return success({ message: "Knowledge updated successfully" });
  } catch (error) {
    logError("Knowledge Additional PUT", error);
    return errors.internalError("Failed to update knowledge");
  }
}

export const PUT = withAuth(handlePut);
