/**
 * Call Sync API Route
 * Syncs call data from Retell API for calls with missing duration or recording
 *
 * POST /api/dashboard/calls/sync
 * Syncs all calls with missing data from Retell API
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/server";
import { getCallDetails } from "@/lib/retell";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePost(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Get all calls with missing data
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for fetching
    const { data: callsToSync, error: fetchError } = await (adminSupabase as any)
      .from("calls")
      .select("id, retell_call_id, duration_seconds, recording_url")
      .eq("business_id", business.id)
      .not("retell_call_id", "is", null)
      .or("duration_seconds.eq.0,duration_seconds.is.null,recording_url.is.null")
      .order("created_at", { ascending: false })
      .limit(50); // Limit to prevent timeout

    if (fetchError) {
      logError("Call Sync", fetchError);
      return errors.internalError("Failed to fetch calls");
    }

    if (!callsToSync || callsToSync.length === 0) {
      return success({
        message: "No calls need syncing",
        synced: 0,
      });
    }

    let syncedCount = 0;
    let errorCount = 0;

    for (const call of callsToSync) {
      try {
        const retellData = await getCallDetails(call.retell_call_id);

        if (retellData && (retellData.duration_ms > 0 || retellData.recording_url)) {
          const durationSeconds = Math.ceil(retellData.duration_ms / 1000);
          const durationMinutesBilled =
            durationSeconds > 0 ? Math.max(1, Math.ceil(durationSeconds / 60)) : 0;

          const updateData: Record<string, unknown> = {};

          if (
            retellData.duration_ms > 0 &&
            (call.duration_seconds === 0 || call.duration_seconds === null)
          ) {
            updateData.duration_seconds = durationSeconds;
            updateData.duration_minutes_billed = durationMinutesBilled;
            if (retellData.start_timestamp) {
              updateData.started_at = new Date(retellData.start_timestamp).toISOString();
            }
            if (retellData.end_timestamp) {
              updateData.ended_at = new Date(retellData.end_timestamp).toISOString();
            }
          }

          if (retellData.recording_url && !call.recording_url) {
            updateData.recording_url = retellData.recording_url;
          }

          if (retellData.transcript_object) {
            updateData.transcript = retellData.transcript_object;
          }

          if (retellData.call_analysis?.call_summary) {
            updateData.summary = retellData.call_analysis.call_summary;
          }

          if (Object.keys(updateData).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for updates
            await (adminSupabase as any).from("calls").update(updateData).eq("id", call.id);
            syncedCount++;
          }
        }
      } catch (error) {
        logError("Call Sync", error);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return success({
      message: `Synced ${syncedCount} calls`,
      synced: syncedCount,
      errors: errorCount,
      total: callsToSync.length,
    });
  } catch (error) {
    logError("Call Sync", error);
    return errors.internalError("Failed to sync calls");
  }
}

export const POST = withAuth(handlePost);
