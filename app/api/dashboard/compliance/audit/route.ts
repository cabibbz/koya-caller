/**
 * Audit Log API Route
 *
 * Provides access to HIPAA audit logs:
 * - GET: Fetch audit logs with filters
 * - GET /export: Export audit logs as CSV
 *
 * Audit logs are append-only and cannot be modified or deleted.
 * 6-year retention is enforced per HIPAA requirements.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  generateAuditReport,
  exportAuditLogsCSV,
  getAuditStatistics,
  type AuditReportFilters,
} from "@/lib/hipaa/audit";
import { checkHIPAAEnabled, AUDIT_EVENT_TYPES, type AuditEventType } from "@/lib/hipaa";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET - Fetch Audit Logs
// =============================================================================

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Check if HIPAA mode is enabled
    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    if (!hipaaEnabled) {
      return errors.forbidden("HIPAA mode not enabled. Audit logs are only available when HIPAA mode is enabled.");
    }

    // Parse query parameters
    const url = new URL(request.url);
    const format = url.searchParams.get("format"); // 'json' or 'csv'
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const eventTypes = url.searchParams.get("event_types");
    const userId = url.searchParams.get("user_id");
    const resourceType = url.searchParams.get("resource_type");
    const resourceId = url.searchParams.get("resource_id");
    const statsOnly = url.searchParams.get("stats_only") === "true";
    const statsDays = parseInt(url.searchParams.get("stats_days") || "30", 10);

    // Stats-only request
    if (statsOnly) {
      const stats = await getAuditStatistics(business.id, statsDays);
      if (!stats) {
        return errors.internalError("Failed to get audit statistics");
      }

      return success(stats);
    }

    // Validate date range
    const now = new Date();
    const defaultEndDate = now;
    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const filters: AuditReportFilters = {
      startDate: startDate ? new Date(startDate) : defaultStartDate,
      endDate: endDate ? new Date(endDate) : defaultEndDate,
    };

    // Validate dates
    if (isNaN(filters.startDate.getTime()) || isNaN(filters.endDate.getTime())) {
      return errors.badRequest("Invalid date format. Use ISO 8601 format (YYYY-MM-DD)");
    }

    // Parse and validate event types
    if (eventTypes) {
      const types = eventTypes.split(",");
      const invalidTypes = types.filter(
        (t) => !AUDIT_EVENT_TYPES.includes(t as AuditEventType)
      );
      if (invalidTypes.length > 0) {
        return errors.validationError("Invalid event types", {
          invalidTypes,
          validTypes: AUDIT_EVENT_TYPES,
        });
      }
      filters.eventTypes = types as AuditEventType[];
    }

    // Add optional filters
    if (userId) {
      filters.userId = userId;
    }
    if (resourceType) {
      filters.resourceType = resourceType;
    }
    if (resourceId) {
      filters.resourceId = resourceId;
    }

    // CSV export
    if (format === "csv") {
      const csv = await exportAuditLogsCSV(business.id, filters);
      if (!csv) {
        return errors.internalError("Failed to export audit logs");
      }

      // Generate filename
      const filename = `audit_logs_${business.id}_${filters.startDate.toISOString().split("T")[0]}_${filters.endDate.toISOString().split("T")[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // JSON report
    const report = await generateAuditReport(business.id, filters);
    if (!report) {
      return errors.internalError("Failed to generate audit report");
    }

    // Limit entries for API response (pagination)
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const paginatedEntries = report.entries.slice(offset, offset + limit);

    return success({
      entries: paginatedEntries,
      totalCount: report.totalCount,
      dateRange: report.dateRange,
      summary: report.summary,
      pagination: {
        limit,
        offset,
        hasMore: offset + paginatedEntries.length < report.totalCount,
      },
      availableEventTypes: AUDIT_EVENT_TYPES,
    });
  } catch (error) {
    logError("Audit Logs GET", error);
    return errors.internalError("Failed to fetch audit logs");
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export const GET = withAuth(handleGet);

// Audit logs are append-only - no PUT, POST, or DELETE allowed
export async function PUT() {
  return errors.methodNotAllowed(["GET"]);
}

export async function POST() {
  return errors.methodNotAllowed(["GET"]);
}

export async function DELETE() {
  return errors.methodNotAllowed(["GET"]);
}
