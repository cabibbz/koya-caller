/**
 * Outbound Call Queue API Route
 * /api/outbound/queue
 *
 * GET: List queued calls for business
 * POST: Add call to queue
 * PATCH: Update queue item (reschedule, cancel)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import {
  getQueuedCalls,
  addToCallQueue,
  updateQueuedCall,
  checkDNC,
} from "@/lib/outbound";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError, logInfo } from "@/lib/logging";
import { toE164, isValidE164 } from "@/lib/utils/phone";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - List queued calls
// =============================================================================

async function handleGet(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const campaignId = searchParams.get("campaign_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get queued calls
    const { calls, total } = await getQueuedCalls(business.id, {
      status,
      campaignId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        calls,
        total,
        limit,
        offset,
        hasMore: offset + calls.length < total,
      },
    });
  } catch (error) {
    logError("Queue GET", error);
    return NextResponse.json(
      { error: "Failed to fetch queued calls" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Add call to queue
// =============================================================================

interface AddToQueueRequest {
  to_number: string;
  purpose: "reminder" | "followup" | "custom";
  appointment_id?: string;
  custom_message?: string;
  scheduled_for?: string; // ISO datetime
  metadata?: Record<string, unknown>;
}

async function handlePost(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Parse request body with error handling
    let body: AddToQueueRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.to_number) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 }
      );
    }

    if (!body.purpose || !["reminder", "followup", "custom"].includes(body.purpose)) {
      return NextResponse.json(
        { error: "purpose must be one of: reminder, followup, custom" },
        { status: 400 }
      );
    }

    // Normalize and validate phone number
    const toNumber = toE164(body.to_number);
    if (!toNumber || !isValidE164(toNumber)) {
      return NextResponse.json(
        { error: "Invalid phone number format. Use E.164 format (+1XXXXXXXXXX)" },
        { status: 400 }
      );
    }

    // Check if outbound is enabled for this business
    const { data: settings } = await (supabase as any)
      .from("outbound_settings")
      .select("outbound_enabled")
      .eq("business_id", business.id)
      .single() as { data: { outbound_enabled: boolean } | null };

    if (!settings?.outbound_enabled) {
      return NextResponse.json(
        { error: "Outbound calling is not enabled for this business" },
        { status: 403 }
      );
    }

    // Check DNC list
    const isDNC = await checkDNC(business.id, toNumber);
    if (isDNC) {
      return NextResponse.json(
        { error: "Number is on the Do-Not-Call list" },
        { status: 400 }
      );
    }

    // Validate scheduled_for if provided
    let scheduledFor: string | undefined;
    if (body.scheduled_for) {
      const scheduledDate = DateTime.fromISO(body.scheduled_for);
      if (!scheduledDate.isValid) {
        return NextResponse.json(
          { error: "Invalid scheduled_for datetime format" },
          { status: 400 }
        );
      }
      // Don't allow scheduling in the past
      if (scheduledDate < DateTime.now()) {
        return NextResponse.json(
          { error: "scheduled_for cannot be in the past" },
          { status: 400 }
        );
      }
      scheduledFor = scheduledDate.toISO() ?? undefined;
    }

    // Add to queue
    const result = await addToCallQueue(business.id, toNumber, {
      purpose: body.purpose,
      appointmentId: body.appointment_id,
      customMessage: body.custom_message,
      metadata: body.metadata,
      scheduledFor,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to add call to queue" },
        { status: 500 }
      );
    }

    logInfo(
      "Queue POST",
      `Added call to ${toNumber} to queue for business ${business.id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        queue_id: result.queueId,
        to_number: toNumber,
        purpose: body.purpose,
        scheduled_for: scheduledFor || new Date().toISOString(),
        status: "pending",
      },
    });
  } catch (error) {
    logError("Queue POST", error);
    return NextResponse.json(
      { error: "Failed to add call to queue" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH Handler - Update queue item
// =============================================================================

interface UpdateQueueRequest {
  id: string;
  scheduled_for?: string;
  status?: "pending" | "cancelled";
  custom_message?: string;
}

async function handlePatch(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Parse request body with error handling
    let body: UpdateQueueRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Build updates
    const updates: {
      scheduledFor?: string;
      status?: "pending" | "cancelled";
      customMessage?: string;
    } = {};

    if (body.scheduled_for) {
      const scheduledDate = DateTime.fromISO(body.scheduled_for);
      if (!scheduledDate.isValid) {
        return NextResponse.json(
          { error: "Invalid scheduled_for datetime format" },
          { status: 400 }
        );
      }
      if (scheduledDate < DateTime.now()) {
        return NextResponse.json(
          { error: "scheduled_for cannot be in the past" },
          { status: 400 }
        );
      }
      updates.scheduledFor = scheduledDate.toISO() ?? undefined;
    }

    if (body.status) {
      if (!["pending", "cancelled"].includes(body.status)) {
        return NextResponse.json(
          { error: "status must be either 'pending' or 'cancelled'" },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    if (body.custom_message !== undefined) {
      updates.customMessage = body.custom_message;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Update the queued call
    const result = await updateQueuedCall(body.id, business.id, updates);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update queued call" },
        { status: 500 }
      );
    }

    logInfo(
      "Queue PATCH",
      `Updated queued call ${body.id} for business ${business.id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        id: body.id,
        updated: updates,
      },
    });
  } catch (error) {
    logError("Queue PATCH", error);
    return NextResponse.json(
      { error: "Failed to update queued call" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user
export const GET = withDashboardRateLimit(handleGet);
export const POST = withDashboardRateLimit(handlePost);
export const PATCH = withDashboardRateLimit(handlePatch);
