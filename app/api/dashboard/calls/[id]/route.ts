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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getCallById, getAppointmentByCallId } from "@/lib/db/calls";
import { getCallDetails } from "@/lib/retell";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Get the call
    const call = await getCallById(id);
    if (!call) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (call.business_id !== business.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Auto-sync missing data from Retell API if needed
    // This handles cases where the webhook didn't update the call properly
    let updatedCall = call;
    if (call.retell_call_id && (call.duration_seconds === 0 || call.duration_seconds === null || !call.recording_url)) {
      console.log(`[Call Detail] Syncing missing data from Retell for call ${call.id} (retell_call_id: ${call.retell_call_id})`);

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
          console.log(`[Call Detail] Updating call ${call.id} with synced data:`, Object.keys(updateData));
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

    return NextResponse.json({
      success: true,
      data: {
        call: updatedCall,
        appointment,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to fetch call details" },
      { status: 500 }
    );
  }
}
