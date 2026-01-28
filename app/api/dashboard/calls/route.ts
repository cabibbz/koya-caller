/**
 * Dashboard Calls API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 678-699
 *
 * GET /api/dashboard/calls
 * Query params: startDate, endDate, outcome, language, search, limit, offset
 * Returns: Paginated list of calls with filters
 *
 * PATCH /api/dashboard/calls
 * Body: { id, flagged?, notes? }
 * Returns: Updated call
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  verifyResourceOwnership,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getCallsByBusinessId,
  getRecentCalls,
  updateCall,
} from "@/lib/db/calls";
import { logError } from "@/lib/logging";
import type { CallOutcome, CallLanguage } from "@/types";

export const dynamic = "force-dynamic";

async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const outcome = searchParams.get("outcome") as CallOutcome | undefined;
    const language = searchParams.get("language") as CallLanguage | undefined;
    const searchQuery = searchParams.get("search") || undefined;
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    // Validate pagination parameters to prevent abuse
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 500);
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;
    const recent = searchParams.get("recent") === "true";

    // If recent flag is set, return just recent calls for dashboard
    if (recent) {
      const recentCalls = await getRecentCalls(business.id, 10);
      return success({
        calls: recentCalls,
        total: recentCalls.length,
        hasMore: false,
      });
    }

    // Get filtered calls
    const { calls, total } = await getCallsByBusinessId(business.id, {
      startDate,
      endDate,
      outcome,
      language,
      searchQuery,
      limit,
      offset,
    });

    return success({
      calls,
      total,
      limit,
      offset,
      hasMore: offset + calls.length < total,
    });
  } catch (error) {
    logError("Dashboard Calls GET", error);
    return errors.internalError("Failed to fetch calls");
  }
}

async function handlePatch(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse request body
    const body = await request.json();
    const { id, flagged, notes } = body;

    if (!id) {
      return errors.badRequest("Call ID is required");
    }

    // Verify call belongs to user's business before updating
    const { data: existingCall, error: callError } = await supabase
      .from("calls")
      .select("id, business_id")
      .eq("id", id)
      .single<{ id: string; business_id: string }>();

    // Check ownership
    const ownershipError = verifyResourceOwnership(
      existingCall,
      business.id,
      "Call"
    );
    if (ownershipError) {
      return ownershipError;
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof flagged === "boolean") {
      updates.flagged = flagged;
    }
    if (typeof notes === "string") {
      if (notes.length > 10000) {
        return errors.badRequest("Notes must be 10000 characters or less");
      }
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      return errors.badRequest("No updates provided");
    }

    // Update the call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Partial updates passed to db helper
    const updatedCall = await updateCall(id, updates as any);

    if (!updatedCall) {
      return errors.internalError("Failed to update call - no data returned");
    }

    return success(updatedCall);
  } catch (error) {
    logError("Dashboard Calls PATCH", error);
    return errors.internalError("Failed to update call");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user (Spec Part 20)
export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
