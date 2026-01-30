/**
 * Data Export Download API Route - GDPR/CCPA Compliance
 *
 * GET /api/privacy/export/[id]/download
 * Downloads the exported data as a JSON file
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDataRequestById, getBusinessExportData } from "@/lib/db/privacy";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/privacy/export/[id]/download
 * Downloads the exported data
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the export request
    const request = await getDataRequestById(id);

    if (!request) {
      return NextResponse.json(
        { error: "Export request not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (request.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if export type
    if (request.request_type !== "export") {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      );
    }

    // Check if completed
    if (request.status !== "completed") {
      return NextResponse.json(
        { error: "Export is not ready yet" },
        { status: 400 }
      );
    }

    // Check if expired
    if (request.export_expires_at) {
      const expiresAt = new Date(request.export_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Export has expired. Please request a new export." },
          { status: 410 }
        );
      }
    }

    // Generate fresh export data (more secure than storing)
    const exportData = await getBusinessExportData(request.business_id);

    // Prepare the JSON content
    const jsonContent = JSON.stringify(exportData, null, 2);

    // Get business name for filename
    const businessName = (exportData.business as { name?: string })?.name || "koya";
    const safeBusinessName = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${safeBusinessName}-data-export-${timestamp}.json`;

    logInfo("Privacy Export Download", `Export downloaded for request ${id}`);

    // Return as downloadable JSON file
    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    logError("Privacy Export Download", error);
    return NextResponse.json(
      { error: "Failed to download export" },
      { status: 500 }
    );
  }
}
