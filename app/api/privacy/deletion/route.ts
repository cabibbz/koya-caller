/**
 * Account Deletion API Route - GDPR/CCPA Compliance
 *
 * POST /api/privacy/deletion
 * Creates a deletion request with 14-day grace period
 *
 * GET /api/privacy/deletion
 * Returns pending deletion request status
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import {
  createDeletionRequest,
  getPendingDeletionRequest,
  getDataRequestsByUserId,
} from "@/lib/db/privacy";
import { inngest } from "@/lib/inngest";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/privacy/deletion
 * Returns the current deletion request status if any
 */
async function handleGet(_request: NextRequest) {
  try {
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

    // Check for pending deletion
    const pendingDeletion = await getPendingDeletionRequest(business.id);

    // Also get all deletion requests for history
    const allRequests = await getDataRequestsByUserId(user.id);
    const deletionRequests = allRequests.filter(
      (r) => r.request_type === "deletion"
    );

    return NextResponse.json({
      success: true,
      data: {
        pendingDeletion,
        history: deletionRequests,
        isScheduledForDeletion: !!pendingDeletion,
      },
    });
  } catch (error) {
    logError("Privacy Deletion GET", error);
    return NextResponse.json(
      { error: "Failed to fetch deletion status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/privacy/deletion
 * Creates a new deletion request with 14-day grace period
 */
async function handlePost(request: NextRequest) {
  try {
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

    // Parse optional feedback reason
    let feedbackReason: string | undefined;
    try {
      const body = await request.json();
      feedbackReason = body.feedbackReason;
    } catch {
      // No body provided, that's fine
    }

    // Check for existing pending deletion
    const existingRequest = await getPendingDeletionRequest(business.id);
    if (existingRequest) {
      return NextResponse.json(
        {
          error: "A deletion request is already pending",
          existingRequest,
        },
        { status: 409 }
      );
    }

    // Create the deletion request
    const deletionRequest = await createDeletionRequest(
      user.id,
      business.id,
      feedbackReason
    );

    logInfo(
      "Privacy Deletion",
      `Deletion request created for business ${business.id}, grace period ends ${deletionRequest.grace_period_ends_at}`
    );

    // Schedule the deletion job with Inngest
    // This will run after the grace period ends
    try {
      await inngest.send({
        name: "privacy/deletion.scheduled",
        data: {
          requestId: deletionRequest.id,
          businessId: business.id,
          userId: user.id,
          gracePeriodEndsAt: deletionRequest.grace_period_ends_at,
        },
      });
    } catch (inngestError) {
      // Log but don't fail - the cron job will pick it up
      logError("Privacy Deletion Inngest", inngestError);
    }

    return NextResponse.json({
      success: true,
      data: {
        request: deletionRequest,
        gracePeriodEndsAt: deletionRequest.grace_period_ends_at,
        message:
          "Your account is scheduled for deletion. You have 14 days to cancel this request.",
      },
    });
  } catch (error) {
    logError("Privacy Deletion POST", error);

    // Handle specific error for duplicate request
    if (
      error instanceof Error &&
      error.message.includes("already pending")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Failed to create deletion request" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user
export const GET = withDashboardRateLimit(handleGet);
export const POST = withDashboardRateLimit(handlePost);
