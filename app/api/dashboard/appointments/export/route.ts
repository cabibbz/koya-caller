/**
 * Appointments Export API Route
 * GET /api/dashboard/appointments/export
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
  appointmentsExportColumns,
  formatExportDate,
  formatPhoneForExport,
} from "@/lib/utils/export";
import type { Appointment } from "@/types";

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

    // Fetch appointments within date range (based on scheduled_at)
    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .gte("scheduled_at", fromDate.toISOString())
      .lte("scheduled_at", toDate.toISOString())
      .order("scheduled_at", { ascending: true });

    if (appointmentsError) {
      logError("Appointments Export - Fetch Error", appointmentsError);
      return errors.internalError("Failed to fetch appointments");
    }

    const appointmentsData = (appointments || []) as Appointment[];

    // Generate filename
    const dateRange = `${format(fromDate, "yyyy-MM-dd")}_to_${format(toDate, "yyyy-MM-dd")}`;
    const filename = `koya-appointments-${dateRange}.${formatType}`;

    if (formatType === "csv") {
      // Generate CSV
      const csv = arrayToCsv(appointmentsData, appointmentsExportColumns);

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
    const title = `Appointments Report`;
    const subtitle = `${format(fromDate, "MMMM d, yyyy")} - ${format(toDate, "MMMM d, yyyy")}`;
    const generatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    // Prepare columns for PDF (subset of full columns)
    const pdfColumns = [
      { header: "Date/Time", width: 120 },
      { header: "Customer", width: 100 },
      { header: "Phone", width: 100 },
      { header: "Service", width: 100 },
      { header: "Duration", width: 60 },
      { header: "Status", width: 70 },
    ];

    // Transform data for PDF
    const statusLabels: Record<string, string> = {
      confirmed: "Confirmed",
      cancelled: "Cancelled",
      completed: "Completed",
      no_show: "No Show",
    };

    const pdfRows = appointmentsData.map((apt) => [
      formatExportDate(apt.scheduled_at),
      apt.customer_name || "",
      formatPhoneForExport(apt.customer_phone),
      apt.service_name || "",
      apt.duration_minutes ? `${apt.duration_minutes}m` : "",
      statusLabels[apt.status] || apt.status,
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
    logError("Appointments Export Error", error);
    return errors.internalError("Failed to generate export");
  }
}

export const GET = withAuth(handleGet);
