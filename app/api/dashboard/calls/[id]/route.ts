/**
 * Call Detail API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 687-692
 *
 * GET /api/dashboard/calls/[id]
 * Returns: Full call details including transcript, recording, appointment
 *
 * Auto-syncs missing data from Retell API if duration is 0 or recording is missing
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/server";
import { getCallById, getAppointmentByCallId } from "@/lib/db/calls";
import { getCallDetails } from "@/lib/retell";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Get the call
    const call = await getCallById(id);
    if (!call) {
      return errors.notFound("Call");
    }

    // Verify ownership
    if (call.business_id !== business.id) {
      return errors.forbidden("Not authorized to view this call");
    }

    // Auto-sync missing data from Retell API if needed
    // This handles cases where the webhook didn't update the call properly
    let updatedCall = call;
    if (call.retell_call_id && (call.duration_seconds === 0 || call.duration_seconds === null || !call.recording_url)) {
      logInfo("Call Detail", `Syncing missing data from Retell for call ${call.id}`);

      const retellData = await getCallDetails(call.retell_call_id);

      if (retellData && (retellData.duration_ms > 0 || retellData.recording_url)) {
        const durationSeconds = Math.ceil(retellData.duration_ms / 1000);
        const durationMinutesBilled = durationSeconds > 0 ? Math.max(1, Math.ceil(durationSeconds / 60)) : 0;

        // Update the database with the synced data
        const adminSupabase = createAdminClient();
        const updateData: Record<string, unknown> = {};

        if (retellData.duration_ms > 0 && (call.duration_seconds === 0 || call.duration_seconds === null)) {
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

        if (retellData.transcript_object && !call.transcript) {
          updateData.transcript = retellData.transcript_object;
        }

        if (retellData.call_analysis?.call_summary && !call.summary) {
          updateData.summary = retellData.call_analysis.call_summary;
        }

        if (Object.keys(updateData).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin client for updates
          await (adminSupabase as any).from("calls").update(updateData).eq("id", call.id);

          // Refresh the call data
          updatedCall = {
            ...call,
            ...updateData,
            duration_seconds: updateData.duration_seconds as number ?? call.duration_seconds,
            recording_url: updateData.recording_url as string ?? call.recording_url,
            transcript: updateData.transcript ?? call.transcript,
            summary: updateData.summary as string ?? call.summary,
          } as typeof call;
        }
      }
    }

    // Get related appointment if any
    const appointment = await getAppointmentByCallId(id);

    return success({
      call: updatedCall,
      appointment,
    });
  } catch (error) {
    logError("Call Detail GET", error);
    return errors.internalError("Failed to fetch call details");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
