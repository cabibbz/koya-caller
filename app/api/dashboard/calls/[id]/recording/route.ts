/**
 * Recording Proxy API Route
 *
 * Proxies recording audio to avoid CORS issues.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleGet(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id: callId } = await context.params;

    // Get the call and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: call, error: callError } = await (supabase as any)
      .from("calls")
      .select("recording_url")
      .eq("id", callId)
      .eq("business_id", business.id)
      .single();

    if (callError || !call) {
      return errors.notFound("Call");
    }

    const recordingUrl = call?.recording_url as string | null;
    if (!recordingUrl) {
      return errors.notFound("No recording available");
    }

    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, max-age=3600",
    };

    // Fetch the recording
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      return errors.internalError("Failed to fetch recording");
    }

    const audioBuffer = await response.arrayBuffer();
    headers["Content-Length"] = audioBuffer.byteLength.toString();

    // Return with proper audio headers
    return new NextResponse(audioBuffer, { headers });
  } catch (error) {
    logError("Recording Proxy", error);
    return errors.internalError("Failed to proxy recording");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
