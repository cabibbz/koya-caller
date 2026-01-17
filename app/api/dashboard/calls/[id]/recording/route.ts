/**
 * Recording Proxy API Route
 * Proxies recording audio to avoid CORS issues
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get the call and verify ownership
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("recording_url")
      .eq("id", params.id)
      .eq("business_id", business.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (!call.recording_url) {
      return NextResponse.json({ error: "No recording available" }, { status: 404 });
    }

    // Fetch the recording
    const response = await fetch(call.recording_url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch recording" }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    // Return with proper audio headers
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Recording proxy error:", error);
    return NextResponse.json({ error: "Failed to proxy recording" }, { status: 500 });
  }
}
