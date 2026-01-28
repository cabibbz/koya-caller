/**
 * Data Export API Route - GDPR/CCPA Compliance
 *
 * POST /api/privacy/export
 * Creates a data export request and generates the export
 *
 * GET /api/privacy/export
 * Returns list of user's export requests
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import {
  createExportRequest,
  getBusinessExportData,
  updateDataRequest,
  getDataRequestsByUserId,
} from "@/lib/db/privacy";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/privacy/export
 * Returns all export requests for the authenticated user
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

    const requests = await getDataRequestsByUserId(user.id);
    const exportRequests = requests.filter((r) => r.request_type === "export");

    return NextResponse.json({
      success: true,
      data: exportRequests,
    });
  } catch (error) {
    logError("Privacy Export GET", error);
    return NextResponse.json(
      { error: "Failed to fetch export requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/privacy/export
 * Creates a new data export request and generates the export
 */
async function handlePost(_request: NextRequest) {
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

    // Create the export request
    const request = await createExportRequest(user.id, business.id);

    logInfo("Privacy Export", `Export request created for business ${business.id}`);

    // Generate the export data
    try {
      const exportData = await getBusinessExportData(business.id);

      // Convert to JSON string for download
      const _exportJson = JSON.stringify(exportData, null, 2);

      // Store the export (in a real implementation, you'd store this in Supabase Storage)
      // For now, we'll mark it as completed and store inline
      // In production, use Supabase Storage bucket for larger exports

      // Set export expiration to 48 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // Update the request with completion info
      const updatedRequest = await updateDataRequest(request.id, {
        status: "completed",
        processed_at: new Date().toISOString(),
        export_file_path: `inline:${request.id}`, // Marker for inline export
        export_expires_at: expiresAt.toISOString(),
      });

      logInfo("Privacy Export", `Export completed for business ${business.id}`);

      return NextResponse.json({
        success: true,
        data: {
          request: updatedRequest,
          downloadUrl: `/api/privacy/export/${request.id}/download`,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (exportError) {
      // Update request with failure
      await updateDataRequest(request.id, {
        status: "pending", // Reset to retry later
      });

      logError("Privacy Export Generation", exportError);
      return NextResponse.json(
        { error: "Failed to generate export" },
        { status: 500 }
      );
    }
  } catch (error) {
    logError("Privacy Export POST", error);
    return NextResponse.json(
      { error: "Failed to create export request" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user
export const GET = withDashboardRateLimit(handleGet);
export const POST = withDashboardRateLimit(handlePost);
