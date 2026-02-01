/**
 * Cancel Deletion Request API Route - GDPR/CCPA Compliance
 *
 * DELETE /api/privacy/deletion/[id]
 * Cancels a pending deletion request and restores the account
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDataRequestById,
  cancelDeletionAndRestore,
} from "@/lib/db/privacy";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/privacy/deletion/[id]
 * Cancels a pending deletion request
 */
async function handleDelete(
  _request: NextRequest,
  context?: RouteParams
): Promise<Response> {
  try {
    if (!context) {
      return NextResponse.json({ error: "Missing route params" }, { status: 400 });
    }
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the deletion request
    const request = await getDataRequestById(id);

    if (!request) {
      return NextResponse.json(
        { error: "Deletion request not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (request.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify it's a deletion request
    if (request.request_type !== "deletion") {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Verify it's still pending
    if (request.status !== "pending") {
      return NextResponse.json(
        {
          error: `Cannot cancel request with status: ${request.status}`,
        },
        { status: 400 }
      );
    }

    // Check if grace period has expired
    if (request.grace_period_ends_at) {
      const gracePeriodEnds = new Date(request.grace_period_ends_at);
      if (gracePeriodEnds < new Date()) {
        return NextResponse.json(
          {
            error:
              "Grace period has expired. Account deletion is in progress and cannot be cancelled.",
          },
          { status: 400 }
        );
      }
    }

    // Cancel the deletion and restore the business
    const cancelledRequest = await cancelDeletionAndRestore(
      id,
      request.business_id
    );

    logInfo(
      "Privacy Deletion Cancel",
      `Deletion request ${id} cancelled for business ${request.business_id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        request: cancelledRequest,
        message: "Account deletion has been cancelled. Your account is restored.",
      },
    });
  } catch (error) {
    logError("Privacy Deletion Cancel", error);
    return NextResponse.json(
      { error: "Failed to cancel deletion request" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const DELETE = withDashboardRateLimit(handleDelete);
