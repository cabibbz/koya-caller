/**
 * Voice Preview Proxy API
 * Proxies voice preview audio to avoid any browser restrictions
 */

import { NextRequest, NextResponse } from "next/server";

// Map of voice IDs to their preview URLs
const VOICE_PREVIEWS: Record<string, string> = {
  "grace-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/grace.mp3",
  "jenny-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/Jenny.mp3",
  "hailey-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-9koBc4DQZJE0dLobwFBt.mp3",
  "adrian-professional": "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
  "brian-warm": "https://retell-utils-public.s3.us-west-2.amazonaws.com/brian.mp3",
  "nico-energetic": "https://retell-utils-public.s3.us-west-2.amazonaws.com/11labs-pdBC2RxjF7wu7aBAu86E.mp3",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get("id");

    if (!voiceId) {
      return NextResponse.json({ error: "Voice ID required" }, { status: 400 });
    }

    const previewUrl = VOICE_PREVIEWS[voiceId];
    if (!previewUrl) {
      return NextResponse.json({ error: "Voice not found" }, { status: 404 });
    }

    // Fetch the audio from S3
    const response = await fetch(previewUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    // Return with proper audio headers
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Voice preview error:", error);
    return NextResponse.json({ error: "Failed to proxy audio" }, { status: 500 });
  }
}
