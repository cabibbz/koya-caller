/**
 * Koya Caller - Weekly Email Reports
 * Sends weekly summary emails to business owners
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyReportEmail } from "@/lib/email";
import { DateTime } from "luxon";
import { getDashboardUrl } from "@/lib/config";

// =============================================================================
// Weekly Report Scheduler (runs every Monday at 9 AM)
// =============================================================================

export const sendWeeklyReports = inngest.createFunction(
  {
    id: "weekly-reports-send",
    name: "Send Weekly Reports",
  },
  { cron: "0 9 * * 1" }, // Every Monday at 9 AM
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get all businesses with weekly reports enabled
    const businesses = await step.run("fetch-businesses", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          timezone,
          minutes_used,
          minutes_limit,
          users!inner (
            email
          ),
          notification_settings (
            email_weekly_report
          )
        `)
        .eq("subscription_status", "active");

      if (error) {
        return [];
      }

      // Filter to only businesses with weekly reports enabled
      return (data || []).filter(
        (b: any) => b.notification_settings?.email_weekly_report !== false
      );
    });

    if (businesses.length === 0) {
      return { sent: 0, skipped: "No businesses with reports enabled" };
    }

    // Queue individual report events
    const events = businesses.map((b: any) => ({
      name: "report/weekly.send" as const,
      data: {
        businessId: b.id,
        businessName: b.name,
        ownerEmail: b.users?.email,
        timezone: b.timezone || "America/New_York",
        minutesUsed: b.minutes_used || 0,
        minutesIncluded: b.minutes_limit || 200,
      },
    }));

    await step.sendEvent("queue-reports", events);

    return {
      queued: events.length,
    };
  }
);

// =============================================================================
// Individual Weekly Report Sender
// =============================================================================

export const sendWeeklyReportEvent = inngest.createFunction(
  {
    id: "weekly-report-individual",
    name: "Send Individual Weekly Report",
    retries: 3,
  },
  { event: "report/weekly.send" },
  async ({ event, step }) => {
    const {
      businessId,
      businessName,
      ownerEmail,
      timezone,
      minutesUsed,
      minutesIncluded,
    } = event.data;

    if (!ownerEmail) {
      return { skipped: true, reason: "No owner email" };
    }

    const supabase = createAdminClient();

    // Calculate date range for last week
    const now = DateTime.now().setZone(timezone);
    const weekEnd = now.startOf("day");
    const weekStart = weekEnd.minus({ days: 7 });

    const weekStartDate = weekStart.toFormat("MMMM d, yyyy");

    // Fetch call stats for the week
    const stats = await step.run("fetch-weekly-stats", async () => {
      const { data: calls, error } = await (supabase as any)
        .from("calls")
        .select("id, outcome, duration_seconds, created_at")
        .eq("business_id", businessId)
        .gte("created_at", weekStart.toISO())
        .lt("created_at", weekEnd.toISO());

      if (error) {
        return {
          totalCalls: 0,
          appointmentsBooked: 0,
          missedCalls: 0,
          avgCallDuration: "0:00",
          topOutcome: "info",
        };
      }

      const callList = calls || [];
      const totalCalls = callList.length;
      const appointmentsBooked = callList.filter((c: any) => c.outcome === "booked").length;
      const missedCalls = callList.filter((c: any) => c.outcome === "missed").length;

      // Calculate average duration
      const totalDuration = callList.reduce(
        (sum: number, c: any) => sum + (c.duration_seconds || 0),
        0
      );
      const avgSeconds = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
      const avgMins = Math.floor(avgSeconds / 60);
      const avgSecs = avgSeconds % 60;
      const avgCallDuration = `${avgMins}:${avgSecs.toString().padStart(2, "0")}`;

      // Find most common outcome
      const outcomeCounts: Record<string, number> = {};
      callList.forEach((c: any) => {
        const outcome = c.outcome || "info";
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
      });
      const topOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "info";

      return {
        totalCalls,
        appointmentsBooked,
        missedCalls,
        avgCallDuration,
        topOutcome,
      };
    });

    // Send the email
    await step.run("send-email", async () => {
      const dashboardUrl = getDashboardUrl("/dashboard");

      await sendWeeklyReportEmail({
        to: ownerEmail,
        businessName,
        weekStartDate,
        stats: {
          ...stats,
          minutesUsed,
          minutesIncluded,
        },
        dashboardUrl,
      });
    });

    return {
      success: true,
      businessId,
      email: ownerEmail,
      weekStartDate,
      stats,
    };
  }
);
