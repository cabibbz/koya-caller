/**
 * Calls Export API Route
 * GET /api/dashboard/calls/export
 *
 * Part of User-Facing Reports feature (PRODUCT_ROADMAP.md Section 2.4)
 *
 * Query params:
 * - format: "csv" | "pdf" (required)
 * - from: ISO date string (required)
 * - to: ISO date string (required)
 *
 * Returns: File download with appropriate headers
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";
import { format } from "date-fns";
import {
  arrayToCsv,
  generatePdfTable,
  callsExportColumns,
  formatExportDate,
  formatPhoneForExport,
  formatDuration,
} from "@/lib/utils/export";
import type { Call } from "@/types";

export const dynamic = "force-dynamic";

async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("format") as "csv" | "pdf" | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Validate parameters
    if (!formatType || !["csv", "pdf"].includes(formatType)) {
      return errors.badRequest("Invalid format. Must be 'csv' or 'pdf'");
    }

    if (!from || !to) {
      return errors.badRequest("Missing required parameters: from and to dates");
    }

    // Validate date format
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return errors.badRequest("Invalid date format");
    }

    // Set time to start/end of day
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Fetch calls within date range
    const { data: calls, error: callsError } = await supabase
      .from("calls")
      .select("*")
      .eq("business_id", business.id)
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString())
      .order("created_at", { ascending: false });

    if (callsError) {
      logError("Calls Export - Fetch Error", callsError);
      return errors.internalError("Failed to fetch calls");
    }

    const callsData = (calls || []) as Call[];

    // Generate filename
    const dateRange = `${format(fromDate, "yyyy-MM-dd")}_to_${format(toDate, "yyyy-MM-dd")}`;
    const filename = `koya-calls-${dateRange}.${formatType}`;

    if (formatType === "csv") {
      // Generate CSV
      const csv = arrayToCsv(callsData, callsExportColumns);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Generate PDF
    const title = `Call History Report`;
    const subtitle = `${format(fromDate, "MMMM d, yyyy")} - ${format(toDate, "MMMM d, yyyy")}`;
    const generatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    // Prepare columns for PDF (subset of full columns)
    const pdfColumns = [
      { header: "Date/Time", width: 120 },
      { header: "Caller", width: 100 },
      { header: "Duration", width: 60 },
      { header: "Outcome", width: 80 },
      { header: "Language", width: 60 },
      { header: "Summary", width: 180 },
    ];

    // Transform data for PDF
    const outcomeLabels: Record<string, string> = {
      booked: "Booked",
      transferred: "Transferred",
      info: "Info Only",
      message: "Message",
      missed: "Missed",
      minutes_exhausted: "Over Limit",
    };

    const pdfRows = callsData.map((call) => [
      formatExportDate(call.created_at),
      formatPhoneForExport(call.from_number),
      formatDuration(call.duration_seconds),
      outcomeLabels[call.outcome || ""] || String(call.outcome || ""),
      call.language === "es" ? "Spanish" : "English",
      call.summary || "",
    ]);

    const pdfBytes = generatePdfTable(title, subtitle, pdfColumns, pdfRows, generatedAt);
    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    logError("Calls Export Error", error);
    return errors.internalError("Failed to generate export");
  }
}

export const GET = withAuth(handleGet);
