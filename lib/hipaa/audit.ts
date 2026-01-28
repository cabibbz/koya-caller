/**
 * HIPAA Audit Logging Middleware
 *
 * Provides middleware and utilities for automatic PHI access logging:
 * - API route wrappers for automatic audit logging
 * - Recording access logging
 * - Transcript access logging
 * - Contact access logging
 * - Audit report generation
 *
 * All audit logs are append-only per HIPAA requirements.
 * 6-year retention is enforced at the database level.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getClientIp } from "@/lib/security";
import { logError } from "@/lib/logging";
import {
  logPHIAccess,
  checkHIPAAEnabled,
  getComplianceSettings,
  type AuditEventType,
  type PHICategory,
} from "./index";

// =============================================================================
// TYPES
// =============================================================================

export interface AuditContext {
  businessId: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  hipaaEnabled: boolean;
  requireJustification: boolean;
}

export interface AuditLogEntry {
  id: string;
  business_id: string;
  user_id: string;
  event_type: AuditEventType;
  resource_type: string;
  resource_id: string;
  action: string;
  justification: string | null;
  ip_address: string | null;
  user_agent: string | null;
  phi_categories: PHICategory[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditReportFilters {
  startDate: Date;
  endDate: Date;
  eventTypes?: AuditEventType[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AuditReportResult {
  entries: AuditLogEntry[];
  totalCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    byEventType: Record<string, number>;
    byUser: Record<string, number>;
    byResourceType: Record<string, number>;
  };
}

// =============================================================================
// MIDDLEWARE HELPERS
// =============================================================================

/**
 * Extract audit context from request
 */
async function getAuditContext(request: NextRequest): Promise<AuditContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return null;
    }

    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    const settings = hipaaEnabled ? await getComplianceSettings(business.id) : null;

    return {
      businessId: business.id,
      userId: user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      hipaaEnabled,
      requireJustification: settings?.require_phi_justification ?? false,
    };
  } catch (error) {
    logError("Get Audit Context", error);
    return null;
  }
}

// =============================================================================
// MIDDLEWARE WRAPPER
// =============================================================================

export type PHIHandler = (
  request: NextRequest,
  context: {
    params?: Record<string, string>;
    audit: AuditContext;
    justification?: string;
  }
) => Promise<Response>;

/**
 * Wrap an API route handler with automatic PHI audit logging
 *
 * Use this for any route that accesses PHI (recordings, transcripts, contacts, etc.)
 *
 * @param handler - The route handler function
 * @param options - Audit options
 * @returns Wrapped handler with audit logging
 *
 * @example
 * export const GET = withPHIAudit(
 *   async (request, { audit, params }) => {
 *     // Access PHI here
 *     return NextResponse.json({ data: phiData });
 *   },
 *   {
 *     eventType: "phi_view",
 *     resourceType: "call",
 *     getResourceId: (req, ctx) => ctx.params?.id,
 *   }
 * );
 */
export function withPHIAudit(
  handler: PHIHandler,
  options: {
    eventType: AuditEventType;
    resourceType: "call" | "recording" | "transcript" | "contact" | "appointment";
    getResourceId: (request: NextRequest, context: { params?: Record<string, string> }) => string | undefined;
    action?: string;
    requireJustification?: boolean;
  }
) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      // Resolve params if they're a promise (Next.js 15+)
      const params = context?.params ? await context.params : undefined;

      // Get audit context
      const audit = await getAuditContext(request);
      if (!audit) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get resource ID
      const resourceId = options.getResourceId(request, { params });
      if (!resourceId) {
        return NextResponse.json({ error: "Resource ID required" }, { status: 400 });
      }

      // Check if justification is required
      let justification: string | undefined;
      const requireJustification =
        options.requireJustification ?? audit.requireJustification;

      if (audit.hipaaEnabled && requireJustification) {
        // Check for justification in request
        justification = request.headers.get("x-phi-justification") || undefined;

        // For POST/PUT requests, also check body
        if (!justification && ["POST", "PUT", "PATCH"].includes(request.method)) {
          try {
            const body = await request.clone().json();
            justification = body.phiJustification || body.justification;
          } catch {
            // Body might not be JSON
          }
        }

        if (!justification) {
          return NextResponse.json(
            {
              error: "PHI justification required",
              code: "PHI_JUSTIFICATION_REQUIRED",
              message: "HIPAA mode requires a justification for accessing PHI",
            },
            { status: 403 }
          );
        }
      }

      // Log PHI access (before the actual access)
      await logPHIAccess({
        businessId: audit.businessId,
        userId: audit.userId,
        eventType: options.eventType,
        resourceType: options.resourceType,
        resourceId,
        action: options.action || `${request.method.toLowerCase()}_${options.resourceType}`,
        justification,
        ipAddress: audit.ipAddress || undefined,
        userAgent: audit.userAgent || undefined,
        metadata: {
          method: request.method,
          url: request.url,
        },
      });

      // Call the actual handler
      return await handler(request, { params, audit, justification });
    } catch (error) {
      logError("PHI Audit Wrapper", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

// =============================================================================
// SPECIFIC ACCESS LOGGING FUNCTIONS
// =============================================================================

/**
 * Log recording access
 *
 * Call this when a user accesses a call recording.
 *
 * @param callId - Call ID
 * @param userId - User accessing the recording
 * @param action - Specific action (view, download, etc.)
 * @param options - Additional options
 */
export async function auditRecordingAccess(
  callId: string,
  userId: string,
  action: "view" | "download" | "play" | "share",
  options?: {
    businessId?: string;
    justification?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string | null> {
  try {
    let businessId = options?.businessId;

    // If business ID not provided, look up from call
    if (!businessId) {
      const supabase = await createClient();
      const { data: call } = await (supabase as any)
        .from("calls")
        .select("business_id")
        .eq("id", callId)
        .single();

      if (!call) {
        logError("Audit Recording Access", new Error("Call not found"));
        return null;
      }
      businessId = call.business_id as string;
    }

    return await logPHIAccess({
      businessId: businessId as string,
      userId,
      eventType: "recording_access",
      resourceType: "recording",
      resourceId: callId,
      action: `recording_${action}`,
      justification: options?.justification,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: {
        accessType: action,
      },
    });
  } catch (error) {
    logError("Audit Recording Access", error);
    return null;
  }
}

/**
 * Log transcript access
 *
 * Call this when a user accesses a call transcript.
 *
 * @param callId - Call ID
 * @param userId - User accessing the transcript
 * @param action - Specific action (view, export, etc.)
 * @param options - Additional options
 */
export async function auditTranscriptAccess(
  callId: string,
  userId: string,
  action: "view" | "export" | "search" | "copy",
  options?: {
    businessId?: string;
    justification?: string;
    ipAddress?: string;
    userAgent?: string;
    phiCategories?: PHICategory[];
  }
): Promise<string | null> {
  try {
    let businessId = options?.businessId;

    // If business ID not provided, look up from call
    if (!businessId) {
      const supabase = await createClient();
      const { data: call } = await (supabase as any)
        .from("calls")
        .select("business_id")
        .eq("id", callId)
        .single();

      if (!call) {
        logError("Audit Transcript Access", new Error("Call not found"));
        return null;
      }
      businessId = call.business_id as string;
    }

    return await logPHIAccess({
      businessId: businessId as string,
      userId,
      eventType: "transcript_access",
      resourceType: "transcript",
      resourceId: callId,
      action: `transcript_${action}`,
      justification: options?.justification,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      phiCategories: options?.phiCategories,
      metadata: {
        accessType: action,
      },
    });
  } catch (error) {
    logError("Audit Transcript Access", error);
    return null;
  }
}

/**
 * Log contact PHI access
 *
 * Call this when a user accesses contact/patient information.
 *
 * @param contactId - Contact/appointment ID or phone number hash
 * @param userId - User accessing the contact
 * @param action - Specific action (view, edit, etc.)
 * @param options - Additional options
 */
export async function auditContactAccess(
  contactId: string,
  userId: string,
  action: "view" | "edit" | "delete" | "export" | "create",
  options?: {
    businessId?: string;
    justification?: string;
    ipAddress?: string;
    userAgent?: string;
    phiCategories?: PHICategory[];
    contactType?: "caller_profile" | "appointment" | "consent";
  }
): Promise<string | null> {
  try {
    let businessId = options?.businessId;

    // If business ID not provided, try to get from user
    if (!businessId) {
      const business = await getBusinessByUserId(userId);
      if (!business) {
        logError("Audit Contact Access", new Error("Business not found for user"));
        return null;
      }
      businessId = business.id;
    }

    return await logPHIAccess({
      businessId,
      userId,
      eventType: "contact_access",
      resourceType: "contact",
      resourceId: contactId,
      action: `contact_${action}`,
      justification: options?.justification,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      phiCategories: options?.phiCategories,
      metadata: {
        accessType: action,
        contactType: options?.contactType,
      },
    });
  } catch (error) {
    logError("Audit Contact Access", error);
    return null;
  }
}

// =============================================================================
// AUDIT REPORT GENERATION
// =============================================================================

/**
 * Generate audit report for compliance/export
 *
 * Creates a comprehensive audit report for a date range.
 * Used for HIPAA compliance audits and investigations.
 *
 * @param businessId - Business ID
 * @param filters - Report filters
 * @returns Audit report with entries and summary
 */
export async function generateAuditReport(
  businessId: string,
  filters: AuditReportFilters
): Promise<AuditReportResult | null> {
  try {
    const supabase = createAdminClient();

    // Build query
    let query = (supabase as any)
      .from("phi_audit_log")
      .select("*", { count: "exact" })
      .eq("business_id", businessId)
      .gte("created_at", filters.startDate.toISOString())
      .lte("created_at", filters.endDate.toISOString())
      .order("created_at", { ascending: false });

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      query = query.in("event_type", filters.eventTypes);
    }

    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.resourceType) {
      query = query.eq("resource_type", filters.resourceType);
    }

    if (filters.resourceId) {
      query = query.eq("resource_id", filters.resourceId);
    }

    const { data, error, count } = await query;

    if (error) {
      logError("Generate Audit Report", error);
      return null;
    }

    const entries = (data || []) as AuditLogEntry[];

    // Generate summary
    const byEventType: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};

    for (const entry of entries) {
      byEventType[entry.event_type] = (byEventType[entry.event_type] || 0) + 1;
      byUser[entry.user_id] = (byUser[entry.user_id] || 0) + 1;
      byResourceType[entry.resource_type] = (byResourceType[entry.resource_type] || 0) + 1;
    }

    return {
      entries,
      totalCount: count || entries.length,
      dateRange: {
        start: filters.startDate.toISOString(),
        end: filters.endDate.toISOString(),
      },
      summary: {
        byEventType,
        byUser,
        byResourceType,
      },
    };
  } catch (error) {
    logError("Generate Audit Report", error);
    return null;
  }
}

/**
 * Export audit logs as CSV
 *
 * @param businessId - Business ID
 * @param filters - Report filters
 * @returns CSV string
 */
export async function exportAuditLogsCSV(
  businessId: string,
  filters: AuditReportFilters
): Promise<string | null> {
  try {
    const report = await generateAuditReport(businessId, filters);
    if (!report) {
      return null;
    }

    // CSV header
    const headers = [
      "ID",
      "Timestamp",
      "User ID",
      "Event Type",
      "Resource Type",
      "Resource ID",
      "Action",
      "Justification",
      "IP Address",
      "PHI Categories",
    ];

    // CSV rows
    const rows = report.entries.map((entry) => [
      entry.id,
      entry.created_at,
      entry.user_id,
      entry.event_type,
      entry.resource_type,
      entry.resource_id,
      entry.action,
      entry.justification || "",
      entry.ip_address || "",
      (entry.phi_categories || []).join(";"),
    ]);

    // Build CSV
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => {
          // Escape and quote values that contain commas, quotes, or newlines
          const str = String(cell);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")
      ),
    ];

    return csvLines.join("\n");
  } catch (error) {
    logError("Export Audit Logs CSV", error);
    return null;
  }
}

/**
 * Get audit log statistics for dashboard
 *
 * @param businessId - Business ID
 * @param days - Number of days to include (default 30)
 * @returns Statistics object
 */
export async function getAuditStatistics(
  businessId: string,
  days: number = 30
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByDay: Record<string, number>;
  uniqueUsers: number;
  phiAccessCount: number;
} | null> {
  try {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await (supabase as any)
      .from("phi_audit_log")
      .select("event_type, user_id, created_at")
      .eq("business_id", businessId)
      .gte("created_at", startDate.toISOString());

    if (error) {
      logError("Get Audit Statistics", error);
      return null;
    }

    const entries = data || [];
    const eventsByType: Record<string, number> = {};
    const eventsByDay: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    let phiAccessCount = 0;

    for (const entry of entries) {
      // Count by type
      eventsByType[entry.event_type] = (eventsByType[entry.event_type] || 0) + 1;

      // Count by day
      const day = entry.created_at.split("T")[0];
      eventsByDay[day] = (eventsByDay[day] || 0) + 1;

      // Track unique users
      uniqueUsers.add(entry.user_id);

      // Count PHI access events
      if (entry.event_type.startsWith("phi_") ||
          entry.event_type.includes("recording") ||
          entry.event_type.includes("transcript")) {
        phiAccessCount++;
      }
    }

    return {
      totalEvents: entries.length,
      eventsByType,
      eventsByDay,
      uniqueUsers: uniqueUsers.size,
      phiAccessCount,
    };
  } catch (error) {
    logError("Get Audit Statistics", error);
    return null;
  }
}
